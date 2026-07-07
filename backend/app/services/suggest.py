"""Kelime alanlarini AI ile doldurma onerisi (Gemini).

Bu, uygulamanin "icinde AI ogretmen calismaz" felsefesini bozmaz: burada AI bir
form-doldurma yardimcisi. Ogretim yine harici sohbetlerde. Anahtar backend'de
(.env), frontend'e asla sizmaz. Anahtar yoksa endpoint 503 doner ve frontend
ucretsiz sozluk (Wiktionary) yoluna duser.

Kelimenin birden fazla yaygin anlami olabilir (orn. "play" = oyun/oynamak) --
bu yuzden tek tahmin degil, en yaygin 5 anlama kadar liste dondurulur; kullanici
frontend'de hangisini istedigini secer.
"""

import json
import os

import httpx

# Frontend PARTS_OF_SPEECH ile ayni 10 kategori (WordForm.tsx).
_POS = [
    "noun", "verb", "adjective", "adverb", "pronoun",
    "preposition", "conjunction", "interjection", "article", "numeral",
]

_MAX_SENSES = 5

_MODEL = "gemini-2.5-flash"
_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODEL}:generateContent"


class SuggestUnavailable(Exception):
    """Anahtar yok ya da saglayici cevap vermedi -> frontend sozluge dusmeli."""


def _api_key() -> str | None:
    key = os.getenv("GEMINI_API_KEY")
    return key.strip() if key else None


def is_available() -> bool:
    return _api_key() is not None


def _clean(val) -> str | None:
    return (val or "").strip() or None


def _clean_word_family(val) -> str | None:
    """word_family alanini normalize eder: AI bazen virgülle ayirir, biz satirlara ceviriz."""
    raw = (val or "").strip()
    if not raw:
        return None
    # Zaten satir satir geliyorsa dokunma
    if "\n" in raw:
        return raw
    # "word1: anlam1, word2: anlam2" formatini tespit et ve satirlara bol
    # Kalip: en az 2 tane "kelime: anlam" virgülle ayrilmis
    import re
    parts = re.split(r",\s*(?=\w+\s*:)", raw)
    if len(parts) >= 2:
        return "\n".join(p.strip() for p in parts if p.strip())
    return raw


def suggest_word(
    term: str,
    target: tuple[str, str],
    native: tuple[str, str],
    helpers: list[tuple[str, str]],
) -> list[dict]:
    """AI'dan kelimenin en yaygin anlamlarini (en fazla 5) ister.

    Her oge: {part_of_speech, meanings: {lang_code: value}}
    """
    key = _api_key()
    if not key:
        raise SuggestUnavailable("GEMINI_API_KEY yok")

    target_code, target_name = target
    native_code, native_name = native
    # Anlam istenecek diller: ana dil + yardimci diller (hedef dil haric).
    meaning_langs = [(native_code, native_name)] + helpers

    meaning_props = {code: {"type": "string"} for code, _ in meaning_langs}
    meaning_desc = ", ".join(f"'{code}' ({name})" for code, name in meaning_langs)

    sense_schema = {
        "type": "object",
        "properties": {
            "part_of_speech": {"type": "string", "enum": _POS},
            "meanings": {"type": "object", "properties": meaning_props},
        },
    }
    schema = {
        "type": "object",
        "properties": {"senses": {"type": "array", "items": sense_schema, "maxItems": _MAX_SENSES}},
    }

    system = (
        "You are a precise bilingual dictionary assistant. Given a word in a target "
        "language, return ONLY JSON matching the schema: a 'senses' array with the "
        f"word's distinct common meanings, ordered by frequency of use, at most "
        f"{_MAX_SENSES}. Usually 1-3 senses is enough; only add more if genuinely "
        "common and distinct (e.g. noun vs verb). Keep dictionary meanings short "
        "(1-4 words). If a field is unknown, use an empty string."
    )
    user = (
        f'Target language: {target_name} ({target_code}). Word: "{term}".\n'
        f"For each sense:\n"
        f"- part_of_speech: one of {', '.join(_POS)}.\n"
        f"- meanings: an object with keys {meaning_desc}; each value is the short "
        f"meaning of THIS SENSE in that language."
    )

    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.2,
        },
    }

    try:
        resp = httpx.post(_URL, params={"key": key}, json=payload, timeout=25.0)
    except httpx.HTTPError as exc:
        raise SuggestUnavailable(f"Gemini istegi basarisiz: {exc}") from exc

    if resp.status_code != 200:
        raise SuggestUnavailable(f"Gemini {resp.status_code}: {resp.text[:200]}")

    try:
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise SuggestUnavailable(f"Gemini cevabi cozulemedi: {exc}") from exc

    senses = parsed.get("senses") or []
    out: list[dict] = []
    for s in senses[:_MAX_SENSES]:
        pos = s.get("part_of_speech")
        if pos not in _POS:
            pos = None
        out.append(
            {
                "part_of_speech": pos,
                "meanings": {
                    code: (val or "").strip()
                    for code, val in (s.get("meanings") or {}).items()
                    if (val or "").strip()
                },
            }
        )
    if not out:
        raise SuggestUnavailable("Gemini bos anlam listesi dondurdu")
    return out


def suggest_word_details(
    term: str,
    part_of_speech: str | None,
    meaning: str,
    target: tuple[str, str],
    native: tuple[str, str],
) -> dict:
    """Belirli bir anlam icin detaylari uretir."""
    key = _api_key()
    if not key:
        raise SuggestUnavailable("GEMINI_API_KEY yok")

    target_code, target_name = target
    native_code, native_name = native

    schema = {
        "type": "object",
        "properties": {
            "phonetic": {"type": "string"},
            "phonetic_native": {"type": "string"},
            "definition_target": {"type": "string"},
            "example_sentence": {"type": "string"},
            "example_translation": {"type": "string"},
            "synonyms": {"type": "string"},
            "antonyms": {"type": "string"},
            "word_family": {"type": "string"},
        },
    }

    system = (
        "You are a precise bilingual dictionary assistant. Given a word and a specific "
        "sense, provide detailed dictionary fields for that exact sense in JSON format. "
        "Keep the definition short. Do not invent phonetics you are unsure of."
    )
    
    pos_str = f" as a {part_of_speech}" if part_of_speech else ""
    user = (
        f'Target language: {target_name} ({target_code}). Word: "{term}"{pos_str}. '
        f'The specific sense/meaning is roughly: "{meaning}".\n'
        f"Provide the following details for this exact sense:\n"
        f"- phonetic: IPA of the word in {target_name}.\n"
        f"- phonetic_native: an approximate reading using {native_name} spelling "
        f"conventions, to help a {native_name} speaker pronounce it (not IPA).\n"
        f"- definition_target: a short definition written IN {target_name}.\n"
        f"- example_sentence: a natural example sentence IN {target_name} using this sense.\n"
        f"- example_translation: that sentence translated into {native_name}.\n"
        f"- synonyms: comma-separated list of synonyms in {target_name}.\n"
        f"- antonyms: comma-separated list of antonyms in {target_name}.\n"
        f"- word_family: related words sharing the same root. IMPORTANT: each entry "
        f"MUST be on its own line, separated by a newline character (\\n). "
        f"Format each line exactly as 'word: meaning in {native_name}'. "
        f"Never put multiple entries on one line or separate them with commas. "
        f"Example value: \"teach: öğretmek\\nteacher: öğretmen\\nteaching: öğretim\"\n"
    )

    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.2,
        },
    }

    try:
        resp = httpx.post(_URL, params={"key": key}, json=payload, timeout=25.0)
    except httpx.HTTPError as exc:
        raise SuggestUnavailable(f"Gemini istegi basarisiz: {exc}") from exc

    if resp.status_code != 200:
        raise SuggestUnavailable(f"Gemini {resp.status_code}: {resp.text[:200]}")

    try:
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        s = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise SuggestUnavailable(f"Gemini cevabi cozulemedi: {exc}") from exc

    return {
        "phonetic": _clean(s.get("phonetic")),
        "phonetic_native": _clean(s.get("phonetic_native")),
        "definition_target": _clean(s.get("definition_target")),
        "example_sentence": _clean(s.get("example_sentence")),
        "example_translation": _clean(s.get("example_translation")),
        "synonyms": _clean(s.get("synonyms")),
        "antonyms": _clean(s.get("antonyms")),
        "word_family": _clean_word_family(s.get("word_family")),
    }

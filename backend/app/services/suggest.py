"""Kelime alanlarini AI ile doldurma onerisi (Gemini).

Bu, uygulamanin "icinde AI ogretmen calismaz" felsefesini bozmaz: burada AI bir
form-doldurma yardimcisi. Ogretim yine harici sohbetlerde. Anahtar backend'de
(.env), frontend'e asla sizmaz. Anahtar yoksa endpoint 503 doner ve frontend
oneriyi "bulunamadi" olarak gosterir.

Kelimenin birden fazla yaygin anlami olabilir (orn. "play" = oyun/oynamak) --
bu yuzden tek tahmin degil, en yaygin 5 anlama kadar liste dondurulur; kullanici
frontend'de hangisini istedigini secer.
"""

import json
import os
from collections.abc import Callable
from typing import TypeVar

import httpx

from app.services import suggestion_cache

# Frontend PARTS_OF_SPEECH ile ayni 10 kategori (WordForm.tsx).
_POS = [
    "noun", "verb", "adjective", "adverb", "pronoun",
    "preposition", "conjunction", "interjection", "article", "numeral",
]

_POS_ALIASES = {
    "n": "noun",
    "noun phrase": "noun",
    "proper noun": "noun",
    "common noun": "noun",
    "gerund": "noun",
    "v": "verb",
    "phrasal verb": "verb",
    "verb phrase": "verb",
    "multi-word verb": "verb",
    "verb particle construction": "verb",
    "auxiliary": "verb",
    "auxiliary verb": "verb",
    "modal": "verb",
    "modal verb": "verb",
    "adj": "adjective",
    "adjectival phrase": "adjective",
    "determiner": "article",
    "adv": "adverb",
    "adverbial phrase": "adverb",
    "prep": "preposition",
    "prepositional phrase": "preposition",
    "conj": "conjunction",
    "coordinating conjunction": "conjunction",
    "subordinating conjunction": "conjunction",
    "determiner article": "article",
    "number": "numeral",
    "cardinal number": "numeral",
    "ordinal number": "numeral",
}

_POS_PHRASE_RULES = [
    ("phrasal verb", "verb"),
    ("verb phrase", "verb"),
    ("multi word verb", "verb"),
    ("particle construction", "verb"),
    ("auxiliary", "verb"),
    ("modal", "verb"),
    ("noun phrase", "noun"),
    ("proper noun", "noun"),
    ("common noun", "noun"),
    ("adjectival", "adjective"),
    ("adjective", "adjective"),
    ("adverbial", "adverb"),
    ("adverb", "adverb"),
    ("prepositional", "preposition"),
    ("preposition", "preposition"),
    ("subordinating conjunction", "conjunction"),
    ("coordinating conjunction", "conjunction"),
    ("conjunction", "conjunction"),
    ("interjection", "interjection"),
    ("exclamation", "interjection"),
    ("determiner", "article"),
    ("article", "article"),
    ("cardinal", "numeral"),
    ("ordinal", "numeral"),
    ("number", "numeral"),
    ("numeral", "numeral"),
    ("pronoun", "pronoun"),
]

_MAX_SENSES = 5

_DEFAULT_MODELS = [
    "gemini-3.5-flash",
    "gemini-3-flash",
    "gemini-2.5-flash",
]
_MODELS = _DEFAULT_MODELS

T = TypeVar("T")


class SuggestUnavailable(Exception):
    """Anahtar yok ya da saglayici saglikli cevap vermedi."""


def _api_key() -> str | None:
    key = os.getenv("GEMINI_API_KEY")
    return key.strip() if key else None


def is_available() -> bool:
    return _api_key() is not None


def _model_names() -> list[str]:
    raw = os.getenv("AI_GEMINI_MODELS")
    if not raw:
        return list(_MODELS)

    models: list[str] = []
    for part in raw.split(","):
        model = part.strip()
        if model and model not in models:
            models.append(model)
    return models or list(_MODELS)


def _clean(val) -> str | None:
    return (val or "").strip() or None


def _normalize_pos(val) -> str | None:
    pos = (val or "").strip().lower().replace("_", " ").replace("-", " ")
    pos = " ".join(pos.split())
    if pos in _POS:
        return pos
    if pos in _POS_ALIASES:
        return _POS_ALIASES[pos]
    for needle, coarse_pos in _POS_PHRASE_RULES:
        if needle in pos:
            return coarse_pos
    return None


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


def _gemini_text(data: dict) -> str:
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise SuggestUnavailable(f"Gemini cevabi eksik: {exc}") from exc
    if not isinstance(text, str) or not text.strip():
        raise SuggestUnavailable("Gemini bos metin dondurdu")
    return text


def _call_gemini_api(
    key: str,
    payload: dict,
    parser: Callable[[dict], T],
    timeout: float = 25.0,
) -> tuple[T, str]:
    """Modelleri sirayla dener; 200 + parse/kalite kontrolu gecerse basarili sayar."""
    last_exc = None
    last_err_text = ""

    for model in _model_names():
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            resp = httpx.post(url, params={"key": key}, json=payload, timeout=timeout)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    return parser(data), model
                except (ValueError, SuggestUnavailable) as exc:
                    last_exc = exc
                    last_err_text = f"{model}: {exc}"
                    continue
            last_err_text = f"{resp.status_code}: {resp.text[:200]}"
        except httpx.HTTPError as exc:
            last_exc = exc

    if last_err_text:
        raise SuggestUnavailable(f"Gemini API modelleri tukendi. Son hata: {last_err_text}")
    if last_exc:
        raise SuggestUnavailable(f"Gemini istegi basarisiz: {last_exc}") from last_exc
    raise SuggestUnavailable("Gemini API istegi yapilamadi.")


def _parse_senses_response(data: dict) -> list[dict]:
    try:
        parsed = json.loads(_gemini_text(data))
    except json.JSONDecodeError as exc:
        raise SuggestUnavailable(f"Gemini JSON cevabi cozulemedi: {exc}") from exc
    if not isinstance(parsed, dict):
        raise SuggestUnavailable("Gemini JSON cevabi obje degil")

    senses = parsed.get("senses") or []
    out: list[dict] = []
    for s in senses[:_MAX_SENSES]:
        if not isinstance(s, dict):
            continue
        pos = _normalize_pos(s.get("part_of_speech"))
        meanings = {
            code: (val or "").strip()
            for code, val in (s.get("meanings") or {}).items()
            if (val or "").strip()
        }
        if not meanings:
            continue
        out.append({"part_of_speech": pos, "meanings": meanings})
    if not out:
        raise SuggestUnavailable("Gemini bos anlam listesi dondurdu")
    return out


def _parse_details_response(data: dict) -> dict:
    try:
        s = json.loads(_gemini_text(data))
    except json.JSONDecodeError as exc:
        raise SuggestUnavailable(f"Gemini JSON cevabi cozulemedi: {exc}") from exc
    if not isinstance(s, dict):
        raise SuggestUnavailable("Gemini detay cevabi obje degil")

    details = {
        "phonetic": _clean(s.get("phonetic")),
        "phonetic_native": _clean(s.get("phonetic_native")),
        "pronunciation_note_native": _clean(s.get("pronunciation_note_native")),
        "level": _clean(s.get("level")) if _clean(s.get("level")) in {"A1", "A2", "B1", "B2", "C1", "C2"} else None,
        "definition_target": _clean(s.get("definition_target")),
        "example_sentence": _clean(s.get("example_sentence")),
        "example_translation": _clean(s.get("example_translation")),
        "synonyms": _clean(s.get("synonyms")),
        "antonyms": _clean(s.get("antonyms")),
        "word_family": _clean_word_family(s.get("word_family")),
    }
    quality_fields = [
        "phonetic",
        "phonetic_native",
        "pronunciation_note_native",
        "level",
        "definition_target",
        "example_sentence",
        "example_translation",
        "word_family",
    ]
    if not any(details.get(field) for field in quality_fields):
        raise SuggestUnavailable("Gemini bos detay cevabi dondurdu")
    return details


def suggest_word(
    term: str,
    target: tuple[str, str],
    native: tuple[str, str],
    helpers: list[tuple[str, str]],
) -> tuple[list[dict], str, str]:
    """AI'dan kelimenin en yaygin anlamlarini (en fazla 5) ister.

    Her oge: {part_of_speech, meanings: {lang_code: value}}
    """
    target_code, target_name = target
    native_code, native_name = native
    # Anlam istenecek diller: ana dil + yardimci diller (hedef dil haric).
    meaning_langs = [(native_code, native_name)] + helpers
    cache_key = suggestion_cache.senses_key(term, target_code, native_code, helpers)
    cached = suggestion_cache.get(cache_key)
    if cached is not None and isinstance(cached.payload, list):
        return cached.payload, cached.model or "cache", "cache"

    key = _api_key()
    if not key:
        raise SuggestUnavailable("GEMINI_API_KEY yok")

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
        f"  Use 'verb' for phrasal verbs and other multi-word verb expressions.\n"
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

    senses, used_model = _call_gemini_api(key, payload, _parse_senses_response)
    return senses, used_model, "gemini"


def suggest_word_details(
    term: str,
    part_of_speech: str | None,
    meaning: str,
    target: tuple[str, str],
    native: tuple[str, str],
    helpers: list[tuple[str, str]] | None = None,
) -> tuple[dict, str, str]:
    """Belirli bir anlam icin detaylari uretir."""
    target_code, target_name = target
    native_code, native_name = native
    helpers = helpers or []
    cache_key = suggestion_cache.details_key(
        term, target_code, native_code, helpers, part_of_speech, meaning
    )
    cached = suggestion_cache.get(cache_key)
    if cached is not None and isinstance(cached.payload, dict):
        return cached.payload, cached.model or "cache", "cache"

    key = _api_key()
    if not key:
        raise SuggestUnavailable("GEMINI_API_KEY yok")

    schema = {
        "type": "object",
        "properties": {
            "phonetic": {"type": "string"},
            "phonetic_native": {"type": "string"},
            "pronunciation_note_native": {"type": "string"},
            "level": {"type": "string", "enum": ["A1", "A2", "B1", "B2", "C1", "C2"]},
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
        "Keep the definition short. Do not invent phonetics you are unsure of. "
        "The pronunciation explanation must be practical, consistent, and written for "
        "a native-language speaker who wants to pronounce the target word."
    )
    
    pos_str = f" as a {part_of_speech}" if part_of_speech else ""
    user = (
        f'Target language: {target_name} ({target_code}). Word: "{term}"{pos_str}. '
        f'The specific sense/meaning is roughly: "{meaning}".\n'
        f"Provide the following details for this exact sense:\n"
        f"- phonetic: IPA of the word in {target_name}.\n"
        f"- phonetic_native: an approximate reading using {native_name} spelling "
        f"conventions, to help a {native_name} speaker pronounce it (not IPA). "
        f"Keep it short, like syllables with stress marks; do not include a long explanation here.\n"
        f"- pronunciation_note_native: write IN {native_name}. Explain how to pronounce the word "
        f"in 1-3 clear sentences, longer only if the word is genuinely difficult. Do not repeat "
        f"the IPA. Do not wrap the short reading in parentheses. Mention practical details such "
        f"as stressed syllable, weak/short sounds, silent letters, linked consonants, lengthened "
        f"vowels, or sounds that do not map cleanly to {native_name}. Use a consistent coaching "
        f"style similar to: 'Ilk hece cok kisa. Vurgu ortadaki hecededir. Sondaki ses yumusak "
        f"tamamlanir.' Adjust the language and examples to {native_name}.\n"
        f"- level: estimated CEFR vocabulary level, one of A1, A2, B1, B2, C1, C2. "
        f"This is a helpful estimate, not a strict exam classification.\n"
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

    details, used_model = _call_gemini_api(key, payload, _parse_details_response)
    return details, used_model, "gemini"


def cache_accepted_word(
    *,
    term: str,
    part_of_speech: str | None,
    meanings_by_code: dict[str, str],
    details: dict[str, str | None],
    target: tuple[str, str],
    native: tuple[str, str],
    helpers: list[tuple[str, str]] | None = None,
    db=None,
) -> None:
    """Kaydedilen kelimeyi kabul edilmis AI cache'i olarak saklar.

    AI cevabi formda beklerken cache'e yazilmaz. Kullanici kelimeyi kaydedince,
    yani oneriyi kabul etmis veya duzeltmis olunca, kaydedilen son hal cache'e girer.
    """
    term = term.strip()
    if not term:
        return

    target_code, _ = target
    native_code, _ = native
    helpers = helpers or []
    clean_meanings = {
        code.strip().lower(): value.strip()
        for code, value in meanings_by_code.items()
        if code.strip() and value and value.strip()
    }
    if not clean_meanings:
        return

    normalized_pos = _normalize_pos(part_of_speech) or _clean(part_of_speech)
    helper_codes = suggestion_cache.helper_codes(helpers)

    suggestion_cache.set(
        cache_key=suggestion_cache.senses_key(term, target_code, native_code, helpers),
        kind="senses",
        term=term,
        target_code=target_code,
        native_code=native_code,
        helper_codes=helper_codes,
        sense_hint=None,
        provider="accepted",
        model="saved",
        payload=[{"part_of_speech": normalized_pos, "meanings": clean_meanings}],
        db=db,
    )

    primary_meaning = clean_meanings.get(native_code.strip().lower()) or next(iter(clean_meanings.values()))
    clean_details = {
        "phonetic": _clean(details.get("phonetic")),
        "phonetic_native": _clean(details.get("phonetic_native")),
        "pronunciation_note_native": _clean(details.get("pronunciation_note_native")),
        "level": _clean(details.get("level")) if _clean(details.get("level")) in {"A1", "A2", "B1", "B2", "C1", "C2"} else None,
        "definition_target": _clean(details.get("definition_target")),
        "example_sentence": _clean(details.get("example_sentence")),
        "example_translation": _clean(details.get("example_translation")),
        "synonyms": _clean(details.get("synonyms")),
        "antonyms": _clean(details.get("antonyms")),
        "word_family": _clean_word_family(details.get("word_family")),
    }
    if not any(clean_details.values()):
        return

    suggestion_cache.set(
        cache_key=suggestion_cache.details_key(
            term, target_code, native_code, helpers, normalized_pos, primary_meaning
        ),
        kind="details",
        term=term,
        target_code=target_code,
        native_code=native_code,
        helper_codes=helper_codes,
        sense_hint=f"{normalized_pos or ''}|{primary_meaning}",
        provider="accepted",
        model="saved",
        payload=clean_details,
        db=db,
    )

"""AI provider/model kalite denemesi.

Bu script uygulama runtime'ina baglanmaz; manuel olarak calistirilir:

    cd backend
    .venv\\Scripts\\python.exe scripts\\evaluate_ai_providers.py

Amac: Gemini/Hugging Face modellerini ayni kelime setiyle deneyip hiz, parse
edilebilirlik ve alan doluluk oranini gormek. Sonuclari DB'ye yazmaz.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")

from app.services import suggest as gemini_suggest  # noqa: E402


DEFAULT_GEMINI_MODELS = [
    "gemini-3.5-flash",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemma-4-26b",
    "gemma-4-31b",
]

DEFAULT_HF_MODELS = [
    "Qwen/Qwen2.5-7B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "meta-llama/Llama-3.1-8B-Instruct",
]

DEFAULT_CASES = [
    ("apple", "noun", "elma"),
    ("acknowledge", "verb", "kabul etmek"),
    ("play", "verb", "oynamak"),
    ("play", "noun", "oyun"),
    ("run", "verb", "kosmak"),
    ("set", "verb", "ayarlamak"),
    ("resilience", "noun", "dayaniklilik"),
    ("subtle", "adjective", "ince, fark edilmesi zor"),
]

TARGET = ("en", "English")
NATIVE = ("tr", "Turkish")
HELPERS = [("de", "German")]

DETAIL_FIELDS = [
    "phonetic",
    "phonetic_native",
    "definition_target",
    "example_sentence",
    "example_translation",
    "synonyms",
    "antonyms",
    "word_family",
]


@dataclass
class Result:
    provider: str
    model: str
    case: str
    ok: bool
    elapsed_ms: int
    filled: int
    total: int
    error: str | None = None


def _csv_env(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    out = [part.strip() for part in raw.split(",") if part.strip()]
    return out or default


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise
        parsed = json.loads(text[start : end + 1])

    if not isinstance(parsed, dict):
        raise ValueError("JSON object bekleniyordu")
    return parsed


def _filled_details(details: dict[str, Any]) -> int:
    return sum(1 for field in DETAIL_FIELDS if str(details.get(field) or "").strip())


def _print_results(results: list[Result]) -> None:
    if not results:
        print("No results.")
        return

    print()
    print("provider model case ok ms filled error")
    print("-" * 96)
    for r in results:
        error = (r.error or "").replace("\n", " ")[:80]
        print(
            f"{r.provider:8} {r.model:32} {r.case:16} "
            f"{'yes' if r.ok else 'no ':3} {r.elapsed_ms:5} "
            f"{r.filled:2}/{r.total:<2} {error}"
        )

    print()
    print("Summary")
    print("-" * 96)
    by_model: dict[tuple[str, str], list[Result]] = {}
    for r in results:
        by_model.setdefault((r.provider, r.model), []).append(r)
    for (provider, model), rows in by_model.items():
        ok_rows = [r for r in rows if r.ok]
        avg_ms = round(sum(r.elapsed_ms for r in rows) / len(rows))
        avg_fill = sum(r.filled for r in ok_rows) / max(1, len(ok_rows))
        print(
            f"{provider:8} {model:32} ok={len(ok_rows)}/{len(rows)} "
            f"avg_ms={avg_ms} avg_filled={avg_fill:.1f}/{len(DETAIL_FIELDS)}"
        )


def _evaluate_gemini_model(model: str, cases: list[tuple[str, str, str]]) -> list[Result]:
    old_models = os.environ.get("AI_GEMINI_MODELS")
    old_cache = os.environ.get("AI_CACHE_ENABLED")
    os.environ["AI_GEMINI_MODELS"] = model
    os.environ["AI_CACHE_ENABLED"] = "false"
    results: list[Result] = []
    try:
        for term, pos, meaning in cases:
            label = f"{term}/{pos}"
            started = time.perf_counter()
            try:
                details, used_model, _source = gemini_suggest.suggest_word_details(
                    term=term,
                    part_of_speech=pos,
                    meaning=meaning,
                    target=TARGET,
                    native=NATIVE,
                    helpers=HELPERS,
                )
                elapsed = round((time.perf_counter() - started) * 1000)
                results.append(
                    Result(
                        provider="gemini",
                        model=used_model,
                        case=label,
                        ok=True,
                        elapsed_ms=elapsed,
                        filled=_filled_details(details),
                        total=len(DETAIL_FIELDS),
                    )
                )
            except Exception as exc:
                elapsed = round((time.perf_counter() - started) * 1000)
                results.append(
                    Result(
                        provider="gemini",
                        model=model,
                        case=label,
                        ok=False,
                        elapsed_ms=elapsed,
                        filled=0,
                        total=len(DETAIL_FIELDS),
                        error=str(exc),
                    )
                )
    finally:
        if old_models is None:
            os.environ.pop("AI_GEMINI_MODELS", None)
        else:
            os.environ["AI_GEMINI_MODELS"] = old_models
        if old_cache is None:
            os.environ.pop("AI_CACHE_ENABLED", None)
        else:
            os.environ["AI_CACHE_ENABLED"] = old_cache
    return results


def _hf_prompt(term: str, pos: str, meaning: str) -> list[dict[str, str]]:
    system = (
        "You are a precise bilingual dictionary assistant. Return only JSON. "
        "Do not include markdown."
    )
    user = (
        f'Target language: English (en). Native language: Turkish (tr). Word: "{term}" '
        f"as a {pos}. The specific sense is roughly: {meaning}.\n"
        "Return exactly this JSON object shape with string values:\n"
        "{"
        '"phonetic":"","phonetic_native":"","definition_target":"",'
        '"example_sentence":"","example_translation":"",'
        '"synonyms":"","antonyms":"","word_family":""'
        "}\n"
        "word_family must use one entry per line in the format 'word: Turkish meaning'."
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _evaluate_hf_model(
    token: str,
    model: str,
    cases: list[tuple[str, str, str]],
) -> list[Result]:
    results: list[Result] = []
    url = "https://router.huggingface.co/v1/chat/completions"
    headers = {"Authorization": f"Bearer {token}"}
    for term, pos, meaning in cases:
        label = f"{term}/{pos}"
        started = time.perf_counter()
        try:
            resp = httpx.post(
                url,
                headers=headers,
                json={
                    "model": model,
                    "messages": _hf_prompt(term, pos, meaning),
                    "temperature": 0.2,
                    "max_tokens": 700,
                },
                timeout=45.0,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            details = _extract_json(content)
            elapsed = round((time.perf_counter() - started) * 1000)
            results.append(
                Result(
                    provider="hf",
                    model=model,
                    case=label,
                    ok=True,
                    elapsed_ms=elapsed,
                    filled=_filled_details(details),
                    total=len(DETAIL_FIELDS),
                )
            )
        except Exception as exc:
            elapsed = round((time.perf_counter() - started) * 1000)
            results.append(
                Result(
                    provider="hf",
                    model=model,
                    case=label,
                    ok=False,
                    elapsed_ms=elapsed,
                    filled=0,
                    total=len(DETAIL_FIELDS),
                    error=str(exc),
                )
            )
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate Lingua AI provider quality.")
    parser.add_argument("--provider", choices=["all", "gemini", "hf"], default="all")
    parser.add_argument("--limit-cases", type=int, default=4)
    parser.add_argument("--gemini-models", default=None)
    parser.add_argument("--hf-models", default=None)
    args = parser.parse_args()

    cases = DEFAULT_CASES[: max(1, args.limit_cases)]
    results: list[Result] = []

    if args.provider in {"all", "gemini"}:
        if not os.getenv("GEMINI_API_KEY"):
            print("Skipping Gemini: GEMINI_API_KEY yok.")
        else:
            gemini_models = (
                [m.strip() for m in args.gemini_models.split(",") if m.strip()]
                if args.gemini_models
                else _csv_env("AI_EVAL_GEMINI_MODELS", DEFAULT_GEMINI_MODELS)
            )
            for model in gemini_models:
                print(f"Evaluating Gemini model: {model}")
                results.extend(_evaluate_gemini_model(model, cases))

    if args.provider in {"all", "hf"}:
        token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
        if not token:
            print("Skipping Hugging Face: HF_TOKEN/HUGGINGFACE_TOKEN yok.")
        else:
            hf_models = (
                [m.strip() for m in args.hf_models.split(",") if m.strip()]
                if args.hf_models
                else _csv_env("AI_HF_MODELS", DEFAULT_HF_MODELS)
            )
            for model in hf_models:
                print(f"Evaluating Hugging Face model: {model}")
                results.extend(_evaluate_hf_model(token, model, cases))

    _print_results(results)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

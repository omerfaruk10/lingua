"""Lokal AI oneri cache'i.

Cache yalnizca backend provider sonuclarini saklar; asil kota tuketen kisim
Gemini/HF istekleridir.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine

PROMPT_VERSION = "gemini-word-suggest-v1"


@dataclass(frozen=True)
class CacheEntry:
    payload: Any
    provider: str | None
    model: str | None


def is_enabled() -> bool:
    return os.getenv("AI_CACHE_ENABLED", "true").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _normalize_term(term: str) -> str:
    return " ".join(term.strip().lower().split())


def _normalize_helpers(helpers: list[tuple[str, str]]) -> str:
    codes = sorted({code.strip().lower() for code, _ in helpers if code.strip()})
    return ",".join(codes)


def _hash(parts: list[str]) -> str:
    raw = "\x1f".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def senses_key(
    term: str,
    target_code: str,
    native_code: str,
    helpers: list[tuple[str, str]],
) -> str:
    return _hash(
        [
            "senses",
            PROMPT_VERSION,
            _normalize_term(term),
            target_code.strip().lower(),
            native_code.strip().lower(),
            _normalize_helpers(helpers),
        ]
    )


def details_key(
    term: str,
    target_code: str,
    native_code: str,
    helpers: list[tuple[str, str]],
    part_of_speech: str | None,
    meaning: str,
) -> str:
    return _hash(
        [
            "details",
            PROMPT_VERSION,
            _normalize_term(term),
            target_code.strip().lower(),
            native_code.strip().lower(),
            _normalize_helpers(helpers),
            (part_of_speech or "").strip().lower(),
            _normalize_term(meaning),
        ]
    )


def get(cache_key: str) -> CacheEntry | None:
    if not is_enabled():
        return None

    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT payload_json, provider, model FROM ai_suggestion_cache "
                    "WHERE cache_key = :cache_key"
                ),
                {"cache_key": cache_key},
            ).mappings().first()
            if row is None:
                return None
            conn.execute(
                text(
                    "UPDATE ai_suggestion_cache "
                    "SET hit_count = hit_count + 1, last_used_at = CURRENT_TIMESTAMP "
                    "WHERE cache_key = :cache_key"
                ),
                {"cache_key": cache_key},
            )
    except SQLAlchemyError:
        return None

    try:
        payload = json.loads(row["payload_json"])
    except json.JSONDecodeError:
        return None
    return CacheEntry(payload=payload, provider=row["provider"], model=row["model"])


def set(
    *,
    cache_key: str,
    kind: str,
    term: str,
    target_code: str,
    native_code: str,
    helper_codes: str,
    sense_hint: str | None,
    provider: str,
    model: str | None,
    payload: Any,
) -> None:
    if not is_enabled():
        return

    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    INSERT INTO ai_suggestion_cache (
                        cache_key, kind, term, target_language_code, native_language_code,
                        helper_language_codes, sense_hint, provider, model, payload_json,
                        prompt_version, created_at, last_used_at, hit_count
                    ) VALUES (
                        :cache_key, :kind, :term, :target_code, :native_code,
                        :helper_codes, :sense_hint, :provider, :model, :payload_json,
                        :prompt_version, CURRENT_TIMESTAMP, NULL, 0
                    )
                    ON CONFLICT(cache_key) DO UPDATE SET
                        provider = excluded.provider,
                        model = excluded.model,
                        payload_json = excluded.payload_json,
                        prompt_version = excluded.prompt_version,
                        created_at = CURRENT_TIMESTAMP
                    """
                ),
                {
                    "cache_key": cache_key,
                    "kind": kind,
                    "term": _normalize_term(term),
                    "target_code": target_code.strip().lower(),
                    "native_code": native_code.strip().lower(),
                    "helper_codes": helper_codes,
                    "sense_hint": sense_hint,
                    "provider": provider,
                    "model": model,
                    "payload_json": payload_json,
                    "prompt_version": PROMPT_VERSION,
                },
            )
    except SQLAlchemyError:
        return


def helper_codes(helpers: list[tuple[str, str]]) -> str:
    return _normalize_helpers(helpers)

import json

import pytest

from app.services import suggest
from app.services.suggest import _normalize_pos, _parse_senses_response


def _gemini_payload(payload: dict) -> dict:
    return {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": json.dumps(payload)}
                    ]
                }
            }
        ]
    }


@pytest.mark.parametrize(
    ("raw_pos", "expected"),
    [
        ("phrasal verb", "verb"),
        ("modal auxiliary verb", "verb"),
        ("proper noun", "noun"),
        ("adjectival phrase", "adjective"),
        ("adverbial phrase", "adverb"),
        ("prepositional phrase", "preposition"),
        ("subordinating conjunction", "conjunction"),
        ("determiner", "article"),
        ("ordinal number", "numeral"),
    ],
)
def test_normalize_pos_maps_specific_labels_to_supported_categories(raw_pos, expected):
    assert _normalize_pos(raw_pos) == expected


def test_parse_senses_normalizes_specific_pos_to_supported_category():
    parsed = _parse_senses_response(
        _gemini_payload(
            {
                "senses": [
                    {
                        "part_of_speech": "phrasal verb",
                        "meanings": {"tr": "goturmek"},
                    }
                ]
            }
        )
    )

    assert parsed == [{"part_of_speech": "verb", "meanings": {"tr": "goturmek"}}]


def test_suggest_word_does_not_cache_unaccepted_ai_response(monkeypatch):
    cache_writes = []

    monkeypatch.setattr(suggest, "_api_key", lambda: "test-key")
    monkeypatch.setattr(suggest.suggestion_cache, "get", lambda key: None)
    monkeypatch.setattr(suggest.suggestion_cache, "set", lambda **kwargs: cache_writes.append(kwargs))
    monkeypatch.setattr(
        suggest,
        "_call_gemini_api",
        lambda key, payload, parser, timeout=25.0: (
            [{"part_of_speech": "verb", "meanings": {"tr": "goturmek"}}],
            "test-model",
        ),
    )

    senses, model, source = suggest.suggest_word(
        "take away",
        target=("en", "English"),
        native=("tr", "Turkish"),
        helpers=[],
    )

    assert senses == [{"part_of_speech": "verb", "meanings": {"tr": "goturmek"}}]
    assert model == "test-model"
    assert source == "gemini"
    assert cache_writes == []


def test_suggest_word_uses_cache_before_requiring_api_key(monkeypatch):
    monkeypatch.setattr(suggest, "_api_key", lambda: None)
    monkeypatch.setattr(
        suggest.suggestion_cache,
        "get",
        lambda key: suggest.suggestion_cache.CacheEntry(
            payload=[{"part_of_speech": "verb", "meanings": {"tr": "goturmek"}}],
            provider="accepted",
            model="saved",
        ),
    )

    senses, model, source = suggest.suggest_word(
        "take away",
        target=("en", "English"),
        native=("tr", "Turkish"),
        helpers=[],
    )

    assert senses == [{"part_of_speech": "verb", "meanings": {"tr": "goturmek"}}]
    assert model == "saved"
    assert source == "cache"


def test_cache_accepted_word_writes_senses_and_details(monkeypatch):
    cache_writes = []
    monkeypatch.setattr(suggest.suggestion_cache, "set", lambda **kwargs: cache_writes.append(kwargs))

    suggest.cache_accepted_word(
        term="take away",
        part_of_speech="phrasal verb",
        meanings_by_code={"tr": "goturmek", "de": "wegbringen"},
        details={
            "phonetic": "/teik ewei/",
            "phonetic_native": "teyk e-vey",
            "pronunciation_note_native": "Iki kelime akici okunur.",
            "level": "A2",
            "definition_target": "To remove something.",
            "example_sentence": "Take away the plates.",
            "example_translation": "Tabaklari gotur.",
            "synonyms": "remove",
            "antonyms": "bring",
            "word_family": "take: almak",
        },
        target=("en", "English"),
        native=("tr", "Turkish"),
        helpers=[("de", "German")],
    )

    assert [write["kind"] for write in cache_writes] == ["senses", "details"]
    assert cache_writes[0]["provider"] == "accepted"
    assert cache_writes[0]["model"] == "saved"
    assert cache_writes[0]["payload"] == [
        {"part_of_speech": "verb", "meanings": {"tr": "goturmek", "de": "wegbringen"}}
    ]
    assert cache_writes[1]["payload"]["level"] == "A2"
    assert cache_writes[1]["sense_hint"] == "verb|goturmek"

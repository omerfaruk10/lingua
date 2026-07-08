from app.services import suggestion_cache


def test_details_cache_key_separates_word_senses():
    helpers = [("de", "German")]

    verb_key = suggestion_cache.details_key(
        "play", "en", "tr", helpers, "verb", "oynamak"
    )
    noun_key = suggestion_cache.details_key(
        "play", "en", "tr", helpers, "noun", "oyun"
    )

    assert verb_key != noun_key


def test_cache_key_normalizes_term_case_and_spacing():
    helpers = [("de", "German"), ("it", "Italian")]

    first = suggestion_cache.senses_key("  Play  ", "EN", "TR", helpers)
    second = suggestion_cache.senses_key("play", "en", "tr", list(reversed(helpers)))

    assert first == second

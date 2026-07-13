import time


def _ids(language):
    """Kursun ana dil (TR) ve yardimci dil (EN) id'leri — anlam eklemek icin."""
    return language["native_language"]["id"], language["helper_languages"][0]["id"]


def _full(language):
    tr_id, en_id = _ids(language)
    return {
        "term": "gatto",
        "phonetic": "gat-to",
        "phonetic_native": "gatto",
        "pronunciation_note_native": "Turkce gibi sert okunur.",
        "part_of_speech": "isim",
        "level": "A1",
        "definition_target": "animale domestico",
        "example_sentence": "Il gatto dorme.",
        "example_translation": "Kedi uyuyor.",
        "meanings": [
            {"language_id": tr_id, "value": "kedi"},
            {"language_id": en_id, "value": "cat"},
        ],
    }


def test_create_full_card(client, language):
    r = client.post(f"/languages/{language['id']}/words", json=_full(language))
    assert r.status_code == 201
    w = r.json()
    assert w["phonetic_native"] == "gatto"
    assert w["pronunciation_note_native"] == "Turkce gibi sert okunur."
    assert w["part_of_speech"] == "isim"
    assert w["level"] == "A1"
    assert w["labels"] == []
    values = {m["value"] for m in w["meanings"]}
    assert values == {"kedi", "cat"}


def test_only_term_required(client, language):
    r = client.post(f"/languages/{language['id']}/words", json={"term": "cane"})
    assert r.status_code == 201
    assert r.json()["meanings"] == []


def test_empty_meanings_skipped(client, language):
    tr_id, _ = _ids(language)
    r = client.post(
        f"/languages/{language['id']}/words",
        json={"term": "cane", "meanings": [{"language_id": tr_id, "value": "  "}]},
    )
    assert r.status_code == 201
    assert r.json()["meanings"] == []


def test_duplicates_allowed(client, language):
    lid = language["id"]
    client.post(f"/languages/{lid}/words", json={"term": "gatto"})
    r = client.post(f"/languages/{lid}/words", json={"term": "gatto"})
    assert r.status_code == 201  # unique yok


def test_search(client, language):
    lid = language["id"]
    tr_id, _ = _ids(language)
    client.post(f"/languages/{lid}/words", json=_full(language))
    client.post(
        f"/languages/{lid}/words",
        json={"term": "cane", "meanings": [{"language_id": tr_id, "value": "kopek"}]},
    )
    assert len(client.get(f"/languages/{lid}/words", params={"search": "cat"}).json()) == 1
    assert len(client.get(f"/languages/{lid}/words", params={"search": "kopek"}).json()) == 1
    assert len(client.get(f"/languages/{lid}/words", params={"search": "gatto"}).json()) == 1


def test_filter_by_level_and_part_of_speech(client, language):
    lid = language["id"]
    client.post(f"/languages/{lid}/words", json=_full(language))
    client.post(
        f"/languages/{lid}/words",
        json={"term": "veloce", "part_of_speech": "adjective", "level": "B1"},
    )

    by_level = client.get(f"/languages/{lid}/words", params={"level": "B1"}).json()
    assert [w["term"] for w in by_level] == ["veloce"]

    by_pos = client.get(f"/languages/{lid}/words", params={"part_of_speech": "isim"}).json()
    assert [w["term"] for w in by_pos] == ["gatto"]


def test_paginated_word_list_is_lightweight_stable_and_filterable(client, language):
    lid = language["id"]
    native_id, _ = _ids(language)
    created = []
    for i in range(30):
        payload = {
            "term": f"word-{i:02d}",
            "level": "B1" if i % 2 else "A1",
            "meanings": [{"language_id": native_id, "value": f"anlam-{i:02d}"}],
        }
        created.append(client.post(f"/languages/{lid}/words", json=payload).json())
    label = client.post(f"/languages/{lid}/labels", json={"name": "important"}).json()
    client.post(f"/languages/{lid}/words/{created[-1]['id']}/labels/{label['id']}")

    first = client.get(f"/languages/{lid}/words/page").json()
    assert first["page"] == 1
    assert first["page_size"] == 25
    assert first["total"] == 30
    assert first["total_pages"] == 2
    assert [item["id"] for item in first["items"]] == [w["id"] for w in created[:25]]
    assert first["items"][0]["primary_meaning"] == "anlam-00"
    assert "definition_target" not in first["items"][0]

    second_response = client.get(
        f"/languages/{lid}/words/page", params={"page": 2, "page_size": 25}
    )
    assert second_response.status_code == 200, second_response.text
    second = second_response.json()
    assert [item["id"] for item in second["items"]] == [w["id"] for w in created[25:]]
    assert [label["name"] for label in second["items"][-1]["labels"]] == ["important"]

    newest = client.get(
        f"/languages/{lid}/words/page", params={"sort": "created_desc"}
    ).json()
    assert newest["items"][0]["id"] == created[-1]["id"]

    filtered = client.get(
        f"/languages/{lid}/words/page",
        params={"search": "word-1", "level": "B1", "sort": "term_asc"},
    ).json()
    assert [item["term"] for item in filtered["items"]] == [
        "word-11",
        "word-13",
        "word-15",
        "word-17",
        "word-19",
    ]


def test_word_page_size_validation_and_counts(client, language):
    lid = language["id"]
    new_word = client.post(f"/languages/{lid}/words", json={"term": "new"}).json()
    learning_word = client.post(f"/languages/{lid}/words", json={"term": "learning"}).json()
    learned_word = client.post(f"/languages/{lid}/words", json={"term": "learned"}).json()
    client.patch(
        f"/languages/{lid}/words/{learning_word['id']}/status",
        json={"status": "learning"},
    )
    client.patch(
        f"/languages/{lid}/words/{learned_word['id']}/status",
        json={"status": "learned"},
    )

    counts = client.get(f"/languages/{lid}/words/counts").json()
    assert counts == {"total": 3, "new": 1, "learning": 1, "learned": 1}
    assert new_word["learning_status"] == "new"
    for page_size in (5, 10):
        response = client.get(
            f"/languages/{lid}/words/page", params={"page_size": page_size}
        )
        assert response.status_code == 200
        assert response.json()["page_size"] == page_size
    assert client.get(
        f"/languages/{lid}/words/page", params={"page_size": 15}
    ).status_code == 422


def test_updated_at_changes(client, language):
    lid = language["id"]
    w = client.post(f"/languages/{lid}/words", json=_full(language)).json()
    time.sleep(1.05)
    r = client.patch(
        f"/languages/{lid}/words/{w['id']}", json={"definition_target": "felino"}
    )
    assert r.json()["definition_target"] == "felino"
    assert r.json()["updated_at"] != w["updated_at"]


def test_update_replaces_meanings(client, language):
    lid = language["id"]
    tr_id, _ = _ids(language)
    w = client.post(f"/languages/{lid}/words", json=_full(language)).json()
    r = client.patch(
        f"/languages/{lid}/words/{w['id']}",
        json={"meanings": [{"language_id": tr_id, "value": "kedicik"}]},
    )
    meanings = r.json()["meanings"]
    assert len(meanings) == 1
    assert meanings[0]["value"] == "kedicik"


def test_clear_field_with_null(client, language):
    lid = language["id"]
    w = client.post(f"/languages/{lid}/words", json=_full(language)).json()
    r = client.patch(f"/languages/{lid}/words/{w['id']}", json={"phonetic": None})
    assert r.json()["phonetic"] is None
    assert r.json()["term"] == "gatto"  # dokunulmadi


def test_cascade_on_language_delete(client, language):
    lid = language["id"]
    w = client.post(f"/languages/{lid}/words", json=_full(language)).json()
    client.delete(f"/languages/{lid}")
    assert client.get(f"/languages/{lid}/words/{w['id']}").status_code == 404

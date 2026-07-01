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
        "part_of_speech": "isim",
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
    assert w["part_of_speech"] == "isim"
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

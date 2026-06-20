import time

FULL = {
    "term": "gatto", "phonetic": "gat-to", "phonetic_tr": "gatto",
    "part_of_speech": "isim", "meaning_native": "kedi", "meaning_english": "cat",
    "definition_target": "animale domestico", "example_sentence": "Il gatto dorme.",
    "example_translation": "Kedi uyuyor.",
}


def test_create_full_card(client, language):
    r = client.post(f"/languages/{language['id']}/words", json=FULL)
    assert r.status_code == 201
    w = r.json()
    assert w["phonetic_tr"] == "gatto"
    assert w["part_of_speech"] == "isim"
    assert w["labels"] == []


def test_only_term_required(client, language):
    r = client.post(f"/languages/{language['id']}/words", json={"term": "cane"})
    assert r.status_code == 201
    assert r.json()["meaning_native"] is None


def test_duplicates_allowed(client, language):
    lid = language["id"]
    client.post(f"/languages/{lid}/words", json={"term": "gatto"})
    r = client.post(f"/languages/{lid}/words", json={"term": "gatto"})
    assert r.status_code == 201  # unique yok


def test_search(client, language):
    lid = language["id"]
    client.post(f"/languages/{lid}/words", json=FULL)
    client.post(f"/languages/{lid}/words", json={"term": "cane", "meaning_native": "kopek"})
    assert len(client.get(f"/languages/{lid}/words", params={"search": "cat"}).json()) == 1
    assert len(client.get(f"/languages/{lid}/words", params={"search": "kopek"}).json()) == 1


def test_updated_at_changes(client, language):
    lid = language["id"]
    w = client.post(f"/languages/{lid}/words", json=FULL).json()
    time.sleep(1.05)
    r = client.patch(f"/languages/{lid}/words/{w['id']}", json={"meaning_native": "kedicik"})
    assert r.json()["meaning_native"] == "kedicik"
    assert r.json()["updated_at"] != w["updated_at"]


def test_clear_field_with_null(client, language):
    lid = language["id"]
    w = client.post(f"/languages/{lid}/words", json=FULL).json()
    r = client.patch(f"/languages/{lid}/words/{w['id']}", json={"phonetic": None})
    assert r.json()["phonetic"] is None
    assert r.json()["term"] == "gatto"  # dokunulmadi


def test_cascade_on_language_delete(client, language):
    lid = language["id"]
    w = client.post(f"/languages/{lid}/words", json=FULL).json()
    client.delete(f"/languages/{lid}")
    assert client.get(f"/languages/{lid}/words/{w['id']}").status_code == 404

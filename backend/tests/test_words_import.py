def _ids(language):
    return language["native_language"]["id"], language["helper_languages"][0]["id"]


def test_import_creates_words_with_meanings(client, language):
    lid = language["id"]
    tr_id, en_id = _ids(language)
    r = client.post(
        f"/languages/{lid}/words/import",
        json={
            "rows": [
                {
                    "term": "gatto",
                    "level": "A1",
                    "pronunciation_note_native": "Kisa ve net okunur.",
                    "meanings": [
                        {"language_id": tr_id, "value": "kedi"},
                        {"language_id": en_id, "value": "cat"},
                    ],
                },
                {"term": "cane"},
            ],
            "label_name": "meyveler",
            "label_color": "#ef4444",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 2
    assert body["replaced"] == 0
    assert body["errors"] == []
    assert body["label"]["name"] == "meyveler"
    assert body["label"]["color"] == "#ef4444"

    words = client.get(f"/languages/{lid}/words").json()
    assert len(words) == 2
    gatto = next(w for w in words if w["term"] == "gatto")
    assert gatto["level"] == "A1"
    assert gatto["pronunciation_note_native"] == "Kisa ve net okunur."
    assert {m["value"] for m in gatto["meanings"]} == {"kedi", "cat"}
    # Partideki tum kelimeler etiketlenir.
    assert all(w["labels"][0]["name"] == "meyveler" for w in words)


def test_import_without_label(client, language):
    lid = language["id"]
    r = client.post(f"/languages/{lid}/words/import", json={"rows": [{"term": "uno"}]})
    assert r.status_code == 200
    assert r.json()["label"] is None
    words = client.get(f"/languages/{lid}/words").json()
    assert words[0]["labels"] == []


def test_import_replace_overwrites_existing_word(client, language):
    lid = language["id"]
    tr_id, _ = _ids(language)
    existing = client.post(
        f"/languages/{lid}/words", json={"term": "gatto", "phonetic": "old"}
    ).json()

    r = client.post(
        f"/languages/{lid}/words/import",
        json={
            "rows": [
                {
                    "term": "gatto",
                    "phonetic": "new",
                    "action": "replace",
                    "replace_word_id": existing["id"],
                    "meanings": [{"language_id": tr_id, "value": "kedicik"}],
                }
            ]
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["created"] == 0
    assert body["replaced"] == 1

    words = client.get(f"/languages/{lid}/words").json()
    assert len(words) == 1  # yeni kelime eklenmedi, var olan guncellendi
    assert words[0]["phonetic"] == "new"
    assert words[0]["meanings"][0]["value"] == "kedicik"


def test_import_label_reused_case_insensitive(client, language):
    lid = language["id"]
    r1 = client.post(
        f"/languages/{lid}/words/import",
        json={"rows": [{"term": "uno"}], "label_name": "Sayılar", "label_color": "#ef4444"},
    )
    label_id = r1.json()["label"]["id"]
    r2 = client.post(
        f"/languages/{lid}/words/import",
        json={"rows": [{"term": "due"}], "label_name": "sayılar", "label_color": "#3b82f6"},
    )
    assert r2.json()["label"]["id"] == label_id  # ayni etiket yeniden kullanildi
    assert r2.json()["label"]["color"] == "#ef4444"  # rengi degismedi

    labels = client.get(f"/languages/{lid}/labels").json()
    assert len(labels) == 1


def test_import_blank_term_reported_but_does_not_block_others(client, language):
    lid = language["id"]
    r = client.post(
        f"/languages/{lid}/words/import",
        json={"rows": [{"term": "  "}, {"term": "valido"}]},
    )
    body = r.json()
    assert body["created"] == 1
    assert len(body["errors"]) == 1
    assert body["errors"][0]["row"] == 1

    words = client.get(f"/languages/{lid}/words").json()
    assert len(words) == 1
    assert words[0]["term"] == "valido"


def test_import_replace_word_from_other_course_reported_as_error(client, language):
    lid = language["id"]
    other = client.post(
        "/languages",
        json={
            "target": {"code": "es", "name": "Spanish", "native_name": "Español"},
            "native": {"code": "tr", "name": "Turkish", "native_name": "Türkçe"},
        },
    ).json()
    other_word = client.post(f"/languages/{other['id']}/words", json={"term": "hola"}).json()

    r = client.post(
        f"/languages/{lid}/words/import",
        json={
            "rows": [
                {"term": "gatto", "action": "replace", "replace_word_id": other_word["id"]}
            ]
        },
    )
    body = r.json()
    assert body["created"] == 0
    assert body["replaced"] == 0
    assert len(body["errors"]) == 1


def test_import_missing_course_404(client):
    r = client.post("/languages/9999/words/import", json={"rows": [{"term": "x"}]})
    assert r.status_code == 404

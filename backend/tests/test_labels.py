def _word(client, lid, term="gatto"):
    return client.post(f"/languages/{lid}/words", json={"term": term}).json()


def test_create_label_with_color(client, language):
    r = client.post(f"/languages/{language['id']}/labels", json={"name": "Hayvanlar", "color": "#22c55e"})
    assert r.status_code == 201
    assert r.json()["color"] == "#22c55e"


def test_color_optional(client, language):
    r = client.post(f"/languages/{language['id']}/labels", json={"name": "Fiiller"})
    assert r.json()["color"] is None


def test_attach_multiple_and_idempotent(client, language):
    lid = language["id"]
    a = client.post(f"/languages/{lid}/labels", json={"name": "Hayvanlar"}).json()
    b = client.post(f"/languages/{lid}/labels", json={"name": "Fiiller"}).json()
    w = _word(client, lid)

    client.post(f"/languages/{lid}/words/{w['id']}/labels/{a['id']}")
    r = client.post(f"/languages/{lid}/words/{w['id']}/labels/{b['id']}")
    assert len(r.json()["labels"]) == 2

    # tekrar ekleme idempotent
    r = client.post(f"/languages/{lid}/words/{w['id']}/labels/{a['id']}")
    assert len(r.json()["labels"]) == 2


def test_filter_by_label(client, language):
    lid = language["id"]
    a = client.post(f"/languages/{lid}/labels", json={"name": "Hayvanlar"}).json()
    b = client.post(f"/languages/{lid}/labels", json={"name": "Fiiller"}).json()
    w1 = _word(client, lid, "gatto")
    w2 = _word(client, lid, "mangiare")
    client.post(f"/languages/{lid}/words/{w1['id']}/labels/{a['id']}")
    client.post(f"/languages/{lid}/words/{w1['id']}/labels/{b['id']}")
    client.post(f"/languages/{lid}/words/{w2['id']}/labels/{b['id']}")

    assert len(client.get(f"/languages/{lid}/words", params={"label_id": b["id"]}).json()) == 2
    res = client.get(f"/languages/{lid}/words", params={"label_id": a["id"]}).json()
    assert len(res) == 1 and res[0]["term"] == "gatto"


def test_detach(client, language):
    lid = language["id"]
    a = client.post(f"/languages/{lid}/labels", json={"name": "Hayvanlar"}).json()
    w = _word(client, lid)
    client.post(f"/languages/{lid}/words/{w['id']}/labels/{a['id']}")
    r = client.delete(f"/languages/{lid}/words/{w['id']}/labels/{a['id']}")
    assert len(r.json()["labels"]) == 0


def test_cross_language_label_404(client, language):
    lid = language["id"]
    other = client.post(
        "/languages", json={"code": "es", "name": "Spanish", "native_name": "Espanol"}
    ).json()
    es_label = client.post(f"/languages/{other['id']}/labels", json={"name": "X"}).json()
    w = _word(client, lid)
    assert client.post(f"/languages/{lid}/words/{w['id']}/labels/{es_label['id']}").status_code == 404


def test_delete_label_keeps_word(client, language):
    lid = language["id"]
    a = client.post(f"/languages/{lid}/labels", json={"name": "Hayvanlar"}).json()
    w = _word(client, lid)
    client.post(f"/languages/{lid}/words/{w['id']}/labels/{a['id']}")

    client.delete(f"/languages/{lid}/labels/{a['id']}")
    r = client.get(f"/languages/{lid}/words/{w['id']}")
    assert r.status_code == 200
    assert len(r.json()["labels"]) == 0  # bag koptu, kelime yasiyor

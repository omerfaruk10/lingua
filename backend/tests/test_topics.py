def test_create_defaults(client, language):
    r = client.post(f"/languages/{language['id']}/topics", json={"title": "Selamlasma"})
    assert r.status_code == 201
    t = r.json()
    assert t["status"] == "not_started"
    assert t["completed_at"] is None


def test_ordering(client, language):
    lid = language["id"]
    client.post(f"/languages/{lid}/topics", json={"title": "Selamlasma", "order_index": 1})
    client.post(f"/languages/{lid}/topics", json={"title": "Sayilar", "order_index": 0})
    titles = [x["title"] for x in client.get(f"/languages/{lid}/topics").json()]
    assert titles == ["Sayilar", "Selamlasma"]


def test_completed_at_automation(client, language):
    lid = language["id"]
    t = client.post(f"/languages/{lid}/topics", json={"title": "X"}).json()

    # done -> tarih dolar
    r = client.patch(f"/languages/{lid}/topics/{t['id']}", json={"status": "done"})
    assert r.json()["completed_at"] is not None

    # done'dan cikinca temizlenir
    r = client.patch(f"/languages/{lid}/topics/{t['id']}", json={"status": "in_progress"})
    assert r.json()["completed_at"] is None


def test_isolation(client, language):
    lid = language["id"]
    other = client.post(
        "/languages", json={"code": "es", "name": "Spanish", "native_name": "Espanol"}
    ).json()
    t = client.post(f"/languages/{lid}/topics", json={"title": "X"}).json()
    # baska dil uzerinden erisim
    assert client.get(f"/languages/{other['id']}/topics/{t['id']}").status_code == 404


def test_missing_language_404(client):
    assert client.post("/languages/9999/topics", json={"title": "X"}).status_code == 404


def test_cascade_on_language_delete(client, language):
    lid = language["id"]
    t = client.post(f"/languages/{lid}/topics", json={"title": "X"}).json()
    client.delete(f"/languages/{lid}")
    assert client.get(f"/languages/{lid}/topics/{t['id']}").status_code == 404

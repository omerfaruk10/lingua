def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_and_read(client):
    r = client.post(
        "/languages", json={"code": "it", "name": "Italian", "native_name": "Italiano"}
    )
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "it"
    assert "id" in body and "created_at" in body

    lid = body["id"]
    assert client.get(f"/languages/{lid}").json()["code"] == "it"


def test_duplicate_code_conflict(client, language):
    r = client.post("/languages", json={"code": "it", "name": "x", "native_name": "y"})
    assert r.status_code == 409


def test_list(client, language):
    r = client.get("/languages")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_partial_update(client, language):
    r = client.patch(f"/languages/{language['id']}", json={"name": "Italyanca"})
    assert r.status_code == 200
    assert r.json()["name"] == "Italyanca"
    assert r.json()["code"] == "it"  # dokunulmadi


def test_get_missing_404(client):
    assert client.get("/languages/9999").status_code == 404


def test_delete(client, language):
    assert client.delete(f"/languages/{language['id']}").status_code == 204
    assert client.get(f"/languages/{language['id']}").status_code == 404

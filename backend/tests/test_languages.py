def _course(target_code="it"):
    return {
        "target": {"code": target_code, "name": target_code.upper(), "native_name": target_code.upper()},
        "native": {"code": "tr", "name": "Turkish", "native_name": "Türkçe"},
        "helpers": [{"code": "en", "name": "English", "native_name": "English"}],
    }


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_course_and_read(client):
    r = client.post("/languages", json=_course("it"))
    assert r.status_code == 201
    body = r.json()
    assert body["code"] == "it"
    assert body["native_language"]["code"] == "tr"
    assert [h["code"] for h in body["helper_languages"]] == ["en"]
    assert "id" in body and "created_at" in body

    lid = body["id"]
    assert client.get(f"/languages/{lid}").json()["code"] == "it"


def test_course_without_helpers(client):
    r = client.post(
        "/languages",
        json={
            "target": {"code": "de", "name": "German", "native_name": "Deutsch"},
            "native": {"code": "tr", "name": "Turkish", "native_name": "Türkçe"},
            "helpers": [],
        },
    )
    assert r.status_code == 201
    assert r.json()["helper_languages"] == []


def test_same_target_multiple_courses_allowed(client):
    # Ayni hedef dil (it) icin farkli ana dillerle birden fazla kurs olusturulabilmeli.
    r1 = client.post("/languages", json=_course("it"))
    assert r1.status_code == 201
    r2 = client.post(
        "/languages",
        json={
            "target": {"code": "it", "name": "Italian", "native_name": "Italiano"},
            "native": {"code": "es", "name": "Spanish", "native_name": "Español"},
            "helpers": [],
        },
    )
    assert r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]
    assert r1.json()["code"] == r2.json()["code"] == "it"
    assert r1.json()["native_language"]["code"] == "tr"
    assert r2.json()["native_language"]["code"] == "es"

    courses = client.get("/languages").json()
    assert len(courses) == 2


def test_exact_duplicate_course_rejected(client):
    # Hedef+ana+yardimci seti birebir ayni olan ikinci kurs reddedilir.
    r1 = client.post("/languages", json=_course("it"))
    assert r1.status_code == 201
    r2 = client.post("/languages", json=_course("it"))
    assert r2.status_code == 409


def test_duplicate_check_ignores_different_helpers(client):
    # Ayni hedef+ana ama farkli yardimci dil seti -> duplicate degil, izin verilir.
    r1 = client.post("/languages", json=_course("it"))
    assert r1.status_code == 201
    r2 = client.post(
        "/languages",
        json={
            "target": {"code": "it", "name": "Italian", "native_name": "Italiano"},
            "native": {"code": "tr", "name": "Turkish", "native_name": "Türkçe"},
            "helpers": [],  # r1'de helper var (en), burada yok -> farkli kombinasyon
        },
    )
    assert r2.status_code == 201


def test_update_into_duplicate_rejected(client):
    # Iki farkli kurs varken, birini digeriyle birebir ayni hale getiren update reddedilir.
    r1 = client.post("/languages", json=_course("it")).json()  # it/tr/en
    r2 = client.post(
        "/languages",
        json={
            "target": {"code": "it"},
            "native": {"code": "es", "name": "Spanish", "native_name": "Español"},
            "helpers": [],
        },
    ).json()  # it/es
    r = client.patch(
        f"/languages/{r2['id']}",
        json={
            "native": {"code": "tr"},
            "helpers": [{"code": "en"}],
        },
    )
    assert r.status_code == 409
    assert r1["id"] != r2["id"]


def test_target_equals_native_rejected(client):
    r = client.post(
        "/languages",
        json={
            "target": {"code": "it", "name": "Italian", "native_name": "Italiano"},
            "native": {"code": "it"},
            "helpers": [],
        },
    )
    assert r.status_code == 400


def test_max_three_helpers(client):
    r = client.post(
        "/languages",
        json={
            "target": {"code": "it", "name": "Italian", "native_name": "Italiano"},
            "native": {"code": "tr", "name": "Turkish", "native_name": "Türkçe"},
            "helpers": [
                {"code": "en", "name": "English", "native_name": "English"},
                {"code": "es", "name": "Spanish", "native_name": "Español"},
                {"code": "fr", "name": "French", "native_name": "Français"},
                {"code": "de", "name": "German", "native_name": "Deutsch"},
            ],
        },
    )
    assert r.status_code == 201
    assert len(r.json()["helper_languages"]) == 3  # dorduncu atilir


def test_list_shows_courses(client, language):
    r = client.get("/languages")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["code"] == "it"


def test_catalog_endpoint(client, language):
    # Ad-hoc yaratilan diller is_catalog=False oldugu icin katalogta gorunmez.
    r = client.get("/languages/catalog")
    assert r.status_code == 200
    assert r.json() == []


def test_update_native_and_helpers(client, language):
    lid = language["id"]
    r = client.patch(
        f"/languages/{lid}",
        json={
            "native": {"code": "es", "name": "Spanish", "native_name": "Español"},
            "helpers": [{"code": "fr", "name": "French", "native_name": "Français"}],
        },
    )
    assert r.status_code == 200
    assert r.json()["native_language"]["code"] == "es"
    assert [h["code"] for h in r.json()["helper_languages"]] == ["fr"]


def test_update_order_index(client, language):
    r = client.patch(f"/languages/{language['id']}", json={"order_index": 5})
    assert r.status_code == 200
    assert r.json()["order_index"] == 5
    assert r.json()["code"] == "it"  # hedef dokunulmadi


def test_get_missing_404(client):
    assert client.get("/languages/9999").status_code == 404


def test_delete(client, language):
    assert client.delete(f"/languages/{language['id']}").status_code == 204
    assert client.get(f"/languages/{language['id']}").status_code == 404

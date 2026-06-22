from datetime import date, timedelta


def _word(client, language, term="gatto"):
    return client.post(f"/languages/{language['id']}/words", json={"term": term}).json()


def test_word_defaults_to_new(client, language):
    w = _word(client, language)
    assert w["learning_status"] == "new"
    assert w["review_stage"] == 0
    assert w["next_review_date"] is None
    assert w["learned_at"] is None


def test_marking_learned_starts_schedule(client, language):
    lid = language["id"]
    w = _word(client, language)
    r = client.patch(f"/languages/{lid}/words/{w['id']}/status", json={"status": "learned"})
    assert r.status_code == 200
    body = r.json()
    assert body["learning_status"] == "learned"
    assert body["review_stage"] == 0
    assert body["next_review_date"] == str(date.today() + timedelta(days=1))
    assert body["learned_at"] is not None


def test_learning_status_is_not_scheduled(client, language):
    lid = language["id"]
    w = _word(client, language)
    body = client.patch(
        f"/languages/{lid}/words/{w['id']}/status", json={"status": "learning"}
    ).json()
    assert body["learning_status"] == "learning"
    assert body["next_review_date"] is None  # programda degil


def test_known_ladder_consolidates(client, language):
    lid = language["id"]
    w = _word(client, language)
    client.patch(f"/languages/{lid}/words/{w['id']}/status", json={"status": "learned"})
    # 5 basamakli merdiven (1,3,7,14,30) -> 5 "biliyordum" sonra pekisir
    for _ in range(5):
        body = client.post(
            f"/languages/{lid}/words/{w['id']}/review", json={"result": "known"}
        ).json()
    assert body["learning_status"] == "learned"  # ogrenilmis kalir
    assert body["review_stage"] == 5
    assert body["next_review_date"] is None  # artik due degil


def test_forgot_resets_but_stays_learned(client, language):
    lid = language["id"]
    w = _word(client, language)
    client.patch(f"/languages/{lid}/words/{w['id']}/status", json={"status": "learned"})
    client.post(f"/languages/{lid}/words/{w['id']}/review", json={"result": "known"})
    body = client.post(
        f"/languages/{lid}/words/{w['id']}/review", json={"result": "forgot"}
    ).json()
    assert body["learning_status"] == "learned"
    assert body["review_stage"] == 0
    assert body["next_review_date"] == str(date.today() + timedelta(days=1))


def test_leaving_learned_clears_schedule(client, language):
    lid = language["id"]
    w = _word(client, language)
    client.patch(f"/languages/{lid}/words/{w['id']}/status", json={"status": "learned"})
    body = client.patch(
        f"/languages/{lid}/words/{w['id']}/status", json={"status": "new"}
    ).json()
    assert body["learning_status"] == "new"
    assert body["review_stage"] == 0
    assert body["next_review_date"] is None
    assert body["learned_at"] is None


def test_status_filter(client, language):
    lid = language["id"]
    a = _word(client, language, "uno")
    _word(client, language, "due")
    client.patch(f"/languages/{lid}/words/{a['id']}/status", json={"status": "learned"})
    learned = client.get(f"/languages/{lid}/words", params={"status": "learned"}).json()
    assert [w["term"] for w in learned] == ["uno"]
    new = client.get(f"/languages/{lid}/words", params={"status": "new"}).json()
    assert [w["term"] for w in new] == ["due"]


def test_due_excludes_future_and_non_learned(client, language):
    lid = language["id"]
    w = _word(client, language)
    # Yeni ogrenilen kelime yarin tekrar edilecek -> bugun due degil
    client.patch(f"/languages/{lid}/words/{w['id']}/status", json={"status": "learned"})
    assert client.get(f"/languages/{lid}/words/due").json() == []
    # 'learning' durumundaki kelime hic due olmaz
    w2 = _word(client, language, "altra")
    client.patch(f"/languages/{lid}/words/{w2['id']}/status", json={"status": "learning"})
    assert client.get(f"/languages/{lid}/words/due").json() == []

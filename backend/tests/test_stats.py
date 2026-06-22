from datetime import datetime, timezone


def _today_local() -> str:
    return datetime.now().date().isoformat()


def test_daily_stats_counts_added_and_reviews(client, language):
    lid = language["id"]
    client.post(f"/languages/{lid}/words", json={"term": "uno"})
    w = client.post(f"/languages/{lid}/words", json={"term": "due"}).json()
    # Ogrenildi yap + bir tekrar logla
    client.patch(f"/languages/{lid}/words/{w['id']}/status", json={"status": "learned"})
    client.post(f"/languages/{lid}/words/{w['id']}/review", json={"result": "known"})

    series = client.get(f"/languages/{lid}/stats/daily").json()
    assert series  # bos degil
    today = next((d for d in series if d["day"] == _today_local()), None)
    assert today is not None
    assert today["added"] == 2
    assert today["reviewed"] == 1


def test_daily_stats_empty_language(client, language):
    series = client.get(f"/languages/{language['id']}/stats/daily").json()
    # Aktivite yoksa bugunu sifirlarla doner (ya da bos) - kirilmamali
    assert isinstance(series, list)


def test_daily_stats_missing_language_404(client):
    assert client.get("/languages/999/stats/daily").status_code == 404

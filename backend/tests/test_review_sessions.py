from datetime import date, timedelta

import app.crud.review_session as review_crud


class Tomorrow(date):
    @classmethod
    def today(cls):
        return date.today() + timedelta(days=1)


def _learned_word(client, course, term="accuse", meaning="suçlamak", example=None):
    payload = {
        "term": term,
        "meanings": [{"language_id": course["native_language"]["id"], "value": meaning}],
    }
    if example:
        payload["example_sentence"] = example
    word = client.post(f"/languages/{course['id']}/words", json=payload).json()
    client.patch(
        f"/languages/{course['id']}/words/{word['id']}/status",
        json={"status": "learned"},
    )
    return word


def _answer(client, course, session, submitted):
    task = session["current_task"]
    return client.post(
        f"/languages/{course['id']}/review-sessions/{session['id']}/answer",
        json={
            "attempt_token": task["attempt_token"],
            "question_type": task["question_type"],
            "submitted_answer": submitted,
        },
    )


def test_review_uses_two_writing_tests_and_advances_from_work_day(client, language, monkeypatch):
    word = _learned_word(client, language, example="They accuse their neighbour.")
    monkeypatch.setattr(review_crud, "date", Tomorrow)

    session = client.post(f"/languages/{language['id']}/review-sessions/current").json()
    assert session["current_task"]["question_type"] == "meaning"
    after_meaning = _answer(client, language, session, "accuse").json()["session"]
    assert after_meaning["current_task"]["question_type"] == "context"
    assert "___" in after_meaning["current_task"]["prompt"]

    finished = _answer(client, language, after_meaning, "accuse").json()["session"]
    assert finished["phase"] == "terminal_ready"
    stored = client.get(f"/languages/{language['id']}/words/{word['id']}").json()
    assert stored["review_stage"] == 1
    assert stored["next_review_date"] == str(Tomorrow.today() + timedelta(days=3))


def test_missing_context_is_logged_as_successful_skip(client, language, monkeypatch):
    _learned_word(client, language)
    monkeypatch.setattr(review_crud, "date", Tomorrow)
    session = client.post(f"/languages/{language['id']}/review-sessions/current").json()
    finished = _answer(client, language, session, "accuse").json()["session"]
    assert finished["phase"] == "terminal_ready"
    assert finished["items"][0]["context_result"] == "skipped_missing_data"


def test_failure_is_remediated_then_preserves_stage_and_anchor(client, language, monkeypatch):
    word = _learned_word(client, language)
    monkeypatch.setattr(review_crud, "date", Tomorrow)
    session = client.post(f"/languages/{language['id']}/review-sessions/current").json()
    failed = _answer(client, language, session, "wrong").json()["session"]
    item = failed["items"][0]
    assert item["item_status"] == "initial_failed"

    remediation = client.post(
        f"/languages/{language['id']}/review-sessions/{session['id']}/items/{item['id']}/open-remediation"
    ).json()
    corrected = _answer(client, language, remediation, "accuse").json()["session"]
    assert corrected["items"][0]["item_status"] == "awaiting_decision"
    decided = client.post(
        f"/languages/{language['id']}/review-sessions/{session['id']}/items/{item['id']}/decision",
        json={"action": "retry_tomorrow"},
    ).json()
    assert decided["phase"] == "terminal_ready"
    stored = client.get(f"/languages/{language['id']}/words/{word['id']}").json()
    assert stored["review_stage"] == 0
    assert stored["review_retry_anchor_date"] is not None
    assert stored["next_review_date"] == str(Tomorrow.today() + timedelta(days=1))

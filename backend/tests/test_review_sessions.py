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

    monkeypatch.setattr(review_crud, "date", date)
    overview = client.get(
        f"/languages/{language['id']}/review-sessions/overview"
    )
    assert overview.status_code == 200
    reviewed_today = overview.json()["reviewed_today"]
    assert reviewed_today[0]["word"]["id"] == word["id"]
    assert reviewed_today[0]["result"] == "success"


def test_missing_context_is_logged_as_successful_skip(client, language, monkeypatch):
    _learned_word(client, language)
    monkeypatch.setattr(review_crud, "date", Tomorrow)
    session = client.post(f"/languages/{language['id']}/review-sessions/current").json()
    finished = _answer(client, language, session, "accuse").json()["session"]
    assert finished["phase"] == "terminal_ready"
    assert finished["items"][0]["context_result"] == "skipped_missing_data"


def test_all_meaning_questions_run_before_context_questions(client, language, monkeypatch):
    _learned_word(
        client,
        language,
        term="accuse",
        meaning="suçlamak",
        example="They accuse their neighbour.",
    )
    _learned_word(
        client,
        language,
        term="acquire",
        meaning="edinmek",
        example="They acquire new skills.",
    )
    monkeypatch.setattr(review_crud, "date", Tomorrow)

    session = client.post(
        f"/languages/{language['id']}/review-sessions/current"
    ).json()
    assert session["current_task"]["question_type"] == "meaning"
    assert session["current_task"]["word"]["term"] == "accuse"

    second_meaning = _answer(client, language, session, "accuse").json()["session"]
    assert second_meaning["current_task"]["question_type"] == "meaning"
    assert second_meaning["current_task"]["word"]["term"] == "acquire"

    first_context = _answer(client, language, second_meaning, "acquire").json()["session"]
    assert first_context["current_task"]["question_type"] == "context"
    assert first_context["current_task"]["word"]["term"] == "accuse"


def test_failure_is_remediated_then_preserves_stage_and_anchor(client, language, monkeypatch):
    word = _learned_word(client, language, example="They accuse their neighbour.")
    distractor = client.post(
        f"/languages/{language['id']}/words",
        json={
            "term": "advertise",
            "meanings": [
                {
                    "language_id": language["native_language"]["id"],
                    "value": "reklamını yapmak",
                }
            ],
        },
    ).json()
    client.patch(
        f"/languages/{language['id']}/words/{distractor['id']}/status",
        json={"status": "learning"},
    )
    monkeypatch.setattr(review_crud, "date", Tomorrow)
    session = client.post(f"/languages/{language['id']}/review-sessions/current").json()
    after_wrong_meaning = _answer(client, language, session, "wrong").json()["session"]
    assert after_wrong_meaning["current_task"]["question_type"] == "context"
    failed = _answer(client, language, after_wrong_meaning, "accuse").json()["session"]
    item = failed["items"][0]
    assert item["item_status"] == "initial_failed"

    remediation = client.post(
        f"/languages/{language['id']}/review-sessions/{session['id']}/items/{item['id']}/open-remediation"
    ).json()
    choice = remediation["current_task"]
    assert choice["question_type"] == "remediation_choice"
    assert choice["prompt"] == "suçlamak"
    assert {option["term"] for option in choice["options"]} == {"accuse", "advertise"}
    after_choice = client.post(
        f"/languages/{language['id']}/review-sessions/{session['id']}/answer",
        json={
            "attempt_token": choice["attempt_token"],
            "question_type": "remediation_choice",
            "selected_word_id": word["id"],
        },
    ).json()["session"]
    assert after_choice["current_task"]["question_type"] == "remediation_typing"
    assert after_choice["current_task"]["prompt"] == "They ___ their neighbour."
    assert word["term"] not in after_choice["current_task"]["prompt"]
    corrected = _answer(client, language, after_choice, "accuse").json()["session"]
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

from datetime import date, timedelta


def _word(client, course, term, meaning=None):
    payload = {"term": term}
    if meaning:
        payload["meanings"] = [
            {"language_id": course["native_language"]["id"], "value": meaning}
        ]
    word = client.post(f"/languages/{course['id']}/words", json=payload).json()
    client.patch(
        f"/languages/{course['id']}/words/{word['id']}/status",
        json={"status": "learning"},
    )
    return word


def _current(client, course):
    return client.post(f"/languages/{course['id']}/learning-sessions/current")


def _answer(client, course, session, task, **payload):
    return client.post(
        f"/languages/{course['id']}/learning-sessions/{session['id']}/answer",
        json={
            "attempt_token": task["attempt_token"],
            "question_type": task["question_type"],
            **payload,
        },
    )


def test_empty_course_does_not_create_session(client, language):
    response = _current(client, language)
    assert response.status_code == 204


def test_current_session_is_persistent_and_uses_oldest_five(client, language):
    words = [_word(client, language, f"word-{i}") for i in range(7)]
    first = _current(client, language)
    assert first.status_code == 200
    body = first.json()
    assert body["progress"]["total_count"] == 5
    assert body["current_task"]["word"]["id"] == words[0]["id"]

    repeated = _current(client, language).json()
    assert repeated["id"] == body["id"]
    assert repeated["current_task"]["attempt_token"] == body["current_task"]["attempt_token"]


def test_single_word_resumes_and_completes_with_srs(client, language):
    word = _word(client, language, "accuse", "suçlamak")
    session = _current(client, language).json()

    intro = _answer(client, language, session, session["current_task"])
    assert intro.status_code == 200
    after_intro = intro.json()["session"]
    assert after_intro["current_task"]["question_type"] == "typing"

    typing_task = after_intro["current_task"]
    typed = _answer(
        client,
        language,
        after_intro,
        typing_task,
        submitted_answer="Accuse",
    )
    assert typed.status_code == 200
    summary = typed.json()["session"]
    assert summary["phase"] == "summary"
    assert summary["summary_items"][0]["word"]["id"] == word["id"]

    completed = client.post(
        f"/languages/{language['id']}/learning-sessions/{session['id']}/complete",
        json={"learned_word_ids": [word["id"]]},
    )
    assert completed.status_code == 200
    done = completed.json()
    assert done["status"] == "completed"
    assert done["completed_word_ids"] == [word["id"]]

    stored = client.get(f"/languages/{language['id']}/words/{word['id']}").json()
    assert stored["learning_status"] == "learned"
    assert stored["next_review_date"] == str(date.today() + timedelta(days=1))


def test_choice_options_are_fixed_and_wrong_answer_returns_later(client, language):
    first = _word(client, language, "accuse", "suçlamak")
    second = _word(client, language, "deny", "reddetmek")
    session = _current(client, language).json()

    # Her iki intro'yu tamamla; FIFO interleaving ilk kelimeyi choice olarak geri getirir.
    response = _answer(client, language, session, session["current_task"]).json()["session"]
    response = _answer(client, language, response, response["current_task"]).json()["session"]
    task = response["current_task"]
    assert task["word"]["id"] == first["id"]
    assert task["question_type"] == "choice"
    fixed = _current(client, language).json()["current_task"]
    assert fixed["attempt_token"] == task["attempt_token"]
    assert fixed["options"] == task["options"]

    wrong = _answer(
        client,
        language,
        response,
        task,
        selected_word_id=second["id"],
    )
    assert wrong.status_code == 200
    assert wrong.json()["result"] == "incorrect"
    # Diğer kelime önce gelir; yanlış yapılan kelime kuyruğun sonundadır.
    assert wrong.json()["session"]["current_task"]["word"]["id"] == second["id"]


def test_answer_replay_is_idempotent_and_different_payload_conflicts(client, language):
    _word(client, language, "accuse", "suçlamak")
    session = _current(client, language).json()
    task = session["current_task"]
    first = _answer(client, language, session, task)
    replay = _answer(client, language, session, task)
    assert replay.status_code == 200
    assert replay.json()["session"]["current_task"]["attempt_token"] == first.json()["session"]["current_task"]["attempt_token"]

    conflict = client.post(
        f"/languages/{language['id']}/learning-sessions/{session['id']}/answer",
        json={
            "attempt_token": task["attempt_token"],
            "question_type": "typing",
            "submitted_answer": "accuse",
        },
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "TOKEN_REUSED"


def test_empty_completion_keeps_words_learning_and_is_idempotent(client, language):
    word = _word(client, language, "solo")  # prompt yok: intro tamamlanınca summary
    session = _current(client, language).json()
    summary = _answer(client, language, session, session["current_task"]).json()["session"]
    assert summary["phase"] == "summary"

    url = f"/languages/{language['id']}/learning-sessions/{session['id']}/complete"
    first = client.post(url, json={"learned_word_ids": []})
    second = client.post(url, json={"learned_word_ids": []})
    assert first.status_code == second.status_code == 200
    assert client.get(f"/languages/{language['id']}/words/{word['id']}").json()["learning_status"] == "learning"


def test_cancel_keeps_word_learning(client, language):
    word = _word(client, language, "accuse", "suçlamak")
    session = _current(client, language).json()
    url = f"/languages/{language['id']}/learning-sessions/{session['id']}/cancel"
    assert client.post(url).status_code == 200
    assert client.post(url).status_code == 200
    assert client.get(f"/languages/{language['id']}/words/{word['id']}").json()["learning_status"] == "learning"
    new_session = _current(client, language).json()
    assert new_session["id"] != session["id"]


def test_manual_status_change_removes_word_from_fixed_batch(client, language):
    first = _word(client, language, "first", "birinci")
    second = _word(client, language, "second", "ikinci")
    session = _current(client, language).json()
    assert session["current_task"]["word"]["id"] == first["id"]

    changed = client.patch(
        f"/languages/{language['id']}/words/{first['id']}/status",
        json={"status": "new"},
    )
    assert changed.status_code == 200
    resumed = _current(client, language).json()
    assert resumed["progress"]["cancelled_count"] == 1
    assert resumed["current_task"]["word"]["id"] == second["id"]


def test_deleting_distractor_regenerates_choice_and_old_token_is_stale(client, language):
    first = _word(client, language, "accuse", "suçlamak")
    second = _word(client, language, "deny", "reddetmek")
    session = _current(client, language).json()
    state = _answer(client, language, session, session["current_task"]).json()["session"]
    state = _answer(client, language, state, state["current_task"]).json()["session"]
    old_task = state["current_task"]
    assert old_task["question_type"] == "choice"

    assert client.delete(f"/languages/{language['id']}/words/{second['id']}").status_code == 204
    refreshed = _current(client, language).json()
    assert refreshed["current_task"]["question_type"] == "typing"
    assert refreshed["current_task"]["attempt_token"] != old_task["attempt_token"]

    stale = _answer(
        client,
        language,
        state,
        old_task,
        selected_word_id=first["id"],
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "STALE_ATTEMPT"


def test_typing_accepts_configured_alternative_and_uses_sentence_context(client, language):
    word = client.post(
        f"/languages/{language['id']}/words",
        json={
            "term": "color",
            "accepted_answers": "colour",
            "example_sentence": "What color is the car?",
            "meanings": [
                {"language_id": language["native_language"]["id"], "value": "renk"}
            ],
        },
    ).json()
    client.patch(
        f"/languages/{language['id']}/words/{word['id']}/status",
        json={"status": "learning"},
    )
    session = _current(client, language).json()
    typing = _answer(client, language, session, session["current_task"]).json()["session"]
    assert typing["current_task"]["question_type"] == "typing"
    assert typing["current_task"]["prompt"] == "What ___ is the car?"
    result = _answer(
        client,
        language,
        typing,
        typing["current_task"],
        submitted_answer="colour",
    )
    assert result.status_code == 200
    assert result.json()["result"] == "correct"
    assert result.json()["session"]["phase"] == "summary"


def test_sentence_context_respects_word_boundaries_and_punctuation(client, language):
    punctuation = _word(client, language, "art", "sanat")
    client.patch(
        f"/languages/{language['id']}/words/{punctuation['id']}",
        json={"example_sentence": "Art, music and literature matter."},
    )
    session = _current(client, language).json()
    typing = _answer(client, language, session, session["current_task"]).json()["session"]
    assert typing["current_task"]["prompt"] == "___, music and literature matter."

    client.post(
        f"/languages/{language['id']}/learning-sessions/{session['id']}/cancel"
    )
    client.patch(
        f"/languages/{language['id']}/words/{punctuation['id']}",
        json={"example_sentence": "The project started yesterday."},
    )
    second = _current(client, language).json()
    typing = _answer(client, language, second, second["current_task"]).json()["session"]
    assert typing["current_task"]["prompt"] == "sanat"

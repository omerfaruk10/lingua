import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../components/Modal'
import { LoadingState } from '../components/LoadingBar'
import { orderMeanings, WordCardContent } from '../components/WordCardContent'
import { useConfirm } from '../components/ConfirmProvider'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useReviewActions, useReviewOverview } from '../hooks/useReviewSession'
import { translateApiError } from '../lib/apiErrors'
import type { ReviewSession, ReviewTask, Word } from '../types'

type Panel = 'today' | 'next' | null

export function ReviewPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const courseId = useLanguageId()
  const course = useCurrentCourse()
  const query = useReviewOverview(courseId)
  const actions = useReviewActions(courseId)
  const [sessionOverride, setSessionOverride] = useState<ReviewSession | null | undefined>()
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [detail, setDetail] = useState<Word | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setSessionOverride(undefined), [query.data])
  const session = sessionOverride === undefined ? query.data?.active_session : sessionOverride
  const meaningOrder = course?.native_language
    ? [course.native_language.id, ...course.helper_languages.map((item) => item.id)]
    : []

  async function start() {
    try { setSessionOverride(await actions.start.mutateAsync()); setError(null) }
    catch (cause) { setError(translateApiError(t, cause)) }
  }

  async function submit(task: ReviewTask, selectedWordId?: number, skip = false) {
    if (!session) return
    try {
      const result = await actions.answer.mutateAsync({
        sessionId: session.id,
        data: {
          attempt_token: task.attempt_token,
          question_type: task.question_type,
          selected_word_id: selectedWordId,
          submitted_answer: selectedWordId === undefined && !skip ? answer : undefined,
          skip,
        },
      })
      setSessionOverride(result.session)
      setAnswer('')
      setFeedback(result.result === 'incorrect' ? t('review.correctAnswer', { word: result.correct_term }) : null)
    } catch (cause) { setError(translateApiError(t, cause)) }
  }

  async function cancel() {
    if (!session || !(await confirm({ title: t('review.cancel'), message: t('review.cancelConfirm'), danger: true }))) return
    try { await actions.cancel.mutateAsync(session.id); setSessionOverride(null) }
    catch (cause) { setError(translateApiError(t, cause)) }
  }

  async function update(run: () => Promise<ReviewSession>) {
    try { setSessionOverride(await run()); setFeedback(null); setError(null) }
    catch (cause) { setError(translateApiError(t, cause)) }
  }

  if (query.isLoading) return <LoadingState label={t('common.loading')} />
  if (query.isError) return <p className="text-rose-600">{translateApiError(t, query.error)}</p>

  const overview = query.data
  const dueWords = [
    ...(session?.items.map((item) => item.word) ?? []),
    ...(overview?.waiting_due_words ?? []),
  ].filter((word, index, all) => all.findIndex((item) => item.id === word.id) === index)
  const reviewedToday = overview?.reviewed_today.map((item) => item.word) ?? []
  const reviewedIds = new Set(reviewedToday.map((word) => word.id))
  const todayWords = [...reviewedToday, ...dueWords].filter(
    (word, index, all) => all.findIndex((item) => item.id === word.id) === index,
  )
  const nextWords = session?.status === 'active'
    ? session.items.map((item) => item.word)
    : dueWords.slice(0, 5)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap gap-2">
        <PanelButton onClick={() => setPanel('today')} label={t('review.todayWords')} count={todayWords.length} />
        <PanelButton onClick={() => setPanel('next')} label={t('review.nextSessionWords')} count={nextWords.length} />
      </div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!session ? (
        <div className="card flex flex-col items-center gap-3 border-dashed p-12 text-center">
          <span className="text-4xl">🧠</span>
          <p className="font-medium text-slate-700">{dueWords.length ? t('review.ready', { n: dueWords.length }) : t('review.empty')}</p>
          <p className="max-w-md text-sm text-slate-400">{t('review.emptyHint')}</p>
          {dueWords.length > 0 && <button className="btn-primary" onClick={start}>{t('review.start')}</button>}
        </div>
      ) : session.phase === 'testing' && session.current_task ? (
        <TestingCard task={session.current_task} answer={answer} setAnswer={setAnswer} feedback={feedback} submit={submit} t={t} />
      ) : session.phase === 'results_remediation' ? (
        <ResultsCard session={session} actions={actions} update={update} answer={answer} setAnswer={setAnswer} submit={submit} t={t} />
      ) : session.phase === 'terminal_ready' ? (
        <div className="card space-y-4 p-8 text-center">
          <p className="text-xl font-semibold">{t('review.finished')}</p>
          <p className="text-sm text-slate-500">{t('review.finishedHint', { n: session.items.filter((i) => i.item_status === 'completed').length })}</p>
          <div className="flex flex-wrap justify-center gap-2">{session.items.map((item) => <button key={item.id} className="cursor-pointer rounded-xl border px-3 py-2 text-sm" onClick={() => setDetail(item.word)}>{item.word.term}</button>)}</div>
          <button className="btn-primary" onClick={() => update(() => actions.complete.mutateAsync(session.id))}>{t('review.complete')}</button>
        </div>
      ) : null}
      {session?.status === 'active' && <button className="text-sm text-slate-400 hover:text-rose-600" onClick={cancel}>{t('review.cancel')}</button>}
      {panel && <WordPanel title={t(panel === 'today' ? 'review.todayWords' : 'review.nextSessionWords')} words={panel === 'today' ? todayWords : nextWords} doneIds={reviewedIds} onClose={() => setPanel(null)} onWord={setDetail} t={t} />}
      {detail && <WordDetail word={detail} meaningOrder={meaningOrder} course={course} onClose={() => setDetail(null)} />}
    </div>
  )
}

function TestingCard({ task, answer, setAnswer, feedback, submit, t }: any) {
  return <div className="card space-y-5 p-8 text-center">
    <div className="text-sm text-slate-400">{task.question_type === 'context' ? t('review.contextTitle') : t('review.meaningTitle')}</div>
    <div className="text-xl font-semibold text-slate-800">{task.prompt}</div>
    <div className="flex gap-2"><input autoFocus className="input flex-1" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && answer.trim() && submit(task)} placeholder={t('learn.typePlaceholder')} /><button className="btn-primary" disabled={!answer.trim()} onClick={() => submit(task)}>{t('learn.check')}</button></div>
    {feedback && <p className="text-sm text-rose-600">{feedback}</p>}
  </div>
}

function ResultsCard({ session, actions, update, answer, setAnswer, submit, t }: any) {
  const task = session.current_task as ReviewTask | null
  if (task) {
    if (task.question_type === 'remediation_choice') return <div className="card space-y-4 p-8 text-center"><p className="font-semibold">{t('review.remediationChoice')}</p><div className="grid gap-2">{task.options.map((option) => <button className="rounded-xl border p-3 hover:border-violet-400" key={option.word_id} onClick={() => submit(task, option.word_id)}>{option.term}</button>)}</div></div>
    return <div className="card space-y-4 p-8 text-center"><p>{t('review.remediationTyping', { word: task.word.term })}</p><input className="input w-full" value={answer} onChange={(e) => setAnswer(e.target.value)} /><div className="flex gap-2"><button className="btn-primary flex-1" onClick={() => submit(task)}>{t('learn.check')}</button><button className="btn-secondary" onClick={() => submit(task, undefined, true)}>{t('review.skipNow')}</button></div></div>
  }
  const failed = session.items.find((item: any) => item.item_status === 'initial_failed')
  if (failed) return <div className="card space-y-4 p-8 text-center"><p>{t('review.failedWord', { word: failed.word.term })}</p><button className="btn-primary" onClick={() => update(() => actions.open.mutateAsync({ sessionId: session.id, itemId: failed.id }))}>{t('review.fixNow')}</button></div>
  const deciding = session.items.find((item: any) => item.item_status === 'awaiting_decision')
  return <div className="card space-y-4 p-8 text-center"><p>{t('review.chooseFailureAction', { word: deciding.word.term })}</p><div className="flex gap-2"><button className="btn-primary flex-1" onClick={() => update(() => actions.decide.mutateAsync({ sessionId: session.id, itemId: deciding.id, action: 'retry_tomorrow' }))}>{t('review.keepStage')}</button><button className="btn-secondary flex-1" onClick={() => update(() => actions.decide.mutateAsync({ sessionId: session.id, itemId: deciding.id, action: 'restart' }))}>{t('review.restart')}</button></div></div>
}

function PanelButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) { return <button onClick={onClick} className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">{label} <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">{count}</span></button> }
function WordPanel({ title, words, doneIds, onClose, onWord, t }: { title: string; words: Word[]; doneIds: Set<number>; onClose: () => void; onWord: (w: Word) => void; t: (key: string) => string }) { return <Modal title={title} onClose={onClose}><div className="grid gap-2">{words.length ? words.map((word) => { const done = doneIds.has(word.id); return <button key={word.id} onClick={() => onWord(word)} className="flex cursor-pointer justify-between rounded-xl border p-3 text-left"><span className="font-medium">{word.term}</span><span className={done ? 'text-emerald-600' : 'text-amber-500'}>{done ? `✓ ${t('review.reviewedState')}` : '⏳'}</span></button> }) : <p className="text-sm text-slate-400">—</p>}</div></Modal> }
function WordDetail({ word, meaningOrder, course, onClose }: any) { return <Modal title={word.term} onClose={onClose}><WordCardContent word={word} orderedMeanings={orderMeanings(word, meaningOrder)} revealed langCode={course?.target_language.code} meaningLangs={course ? [course.native_language, ...course.helper_languages] : []} targetLang={course?.target_language} /></Modal> }

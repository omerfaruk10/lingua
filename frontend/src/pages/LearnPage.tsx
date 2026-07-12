import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../api/client'
import { orderMeanings, WordCardContent } from '../components/WordCardContent'
import { useConfirm } from '../components/ConfirmProvider'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import {
  useAnswerLearningSession,
  useCancelLearningSession,
  useCompleteLearningSession,
  useLearningSession,
} from '../hooks/useLearningSession'
import { useWords } from '../hooks/useWords'
import { translateApiError } from '../lib/apiErrors'
import type { LanguageBrief, LearningSession, LearningTask, Word } from '../types'

interface Feedback {
  kind: 'accent' | 'wrong'
  correct: string
}

export function LearnPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const languageId = useLanguageId()
  const course = useCurrentCourse()
  const targetLocale = course?.target_language.code ?? 'en'
  const meaningOrder = course?.native_language
    ? [course.native_language.id, ...course.helper_languages.map((h) => h.id)]
    : []

  const query = useLearningSession(languageId)
  const { data: learningWords } = useWords(languageId, { status: 'learning' })
  const answer = useAnswerLearningSession(languageId)
  const complete = useCompleteLearningSession(languageId)
  const cancel = useCancelLearningSession(languageId)

  const [sessionOverride, setSessionOverride] = useState<{ value: LearningSession | null } | null>(null)
  const [stagedSession, setStagedSession] = useState<LearningSession | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  const session = sessionOverride ? sessionOverride.value : query.data

  if (query.isLoading) {
    return <p className="text-slate-400">{t('common.loading')}</p>
  }

  if (query.isError && !session) {
    return <ErrorCard message={translateApiError(t, query.error)} onRetry={() => query.refetch()} />
  }

  if (!session) {
    return (
      <div className="card mx-auto flex w-full max-w-2xl flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">📚</span>
        <p className="font-medium text-slate-700">{t('learn.empty')}</p>
        <p className="max-w-sm text-sm text-slate-400">{t('learn.emptyHint')}</p>
      </div>
    )
  }

  async function submitAnswer(
    task: LearningTask,
    payload: { selected_word_id?: number; submitted_answer?: string } = {},
  ) {
    if (!session) return
    setActionError(null)
    try {
      const result = await answer.mutateAsync({
        sessionId: session.id,
        data: {
          attempt_token: task.attempt_token,
          question_type: task.question_type,
          ...payload,
        },
      })
      if (result.result === 'incorrect' || result.result === 'minor_typo') {
        setFeedback({
          kind: result.result === 'minor_typo' ? 'accent' : 'wrong',
          correct: result.correct_term ?? task.word.term,
        })
        setStagedSession(result.session)
      } else {
        setSessionOverride({ value: result.session })
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'STALE_ATTEMPT' && error.currentSession) {
        setFeedback(null)
        setStagedSession(null)
        setSessionOverride({ value: error.currentSession as LearningSession })
      } else {
        setActionError(translateApiError(t, error))
      }
    }
  }

  function continueAfterFeedback() {
    if (stagedSession) setSessionOverride({ value: stagedSession })
    setStagedSession(null)
    setFeedback(null)
  }

  async function markLearned() {
    const wordIds = session!.summary_items
      .filter((item) => checked[item.word.id])
      .map((item) => item.word.id)
    setActionError(null)
    try {
      const result = await complete.mutateAsync({ sessionId: session!.id, wordIds })
      setSessionOverride({ value: result })
    } catch (error) {
      setActionError(translateApiError(t, error))
    }
  }

  async function cancelSession() {
    const ok = await confirm({
      message: t('learn.cancelConfirm'),
      confirmLabel: t('learn.cancelSession'),
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    try {
      const result = await cancel.mutateAsync(session!.id)
      setSessionOverride({ value: result.session })
    } catch (error) {
      setActionError(translateApiError(t, error))
    }
  }

  async function startNextBatch() {
    setSessionOverride({ value: null })
    setFeedback(null)
    setStagedSession(null)
    setChecked({})
    const result = await query.refetch()
    setSessionOverride({ value: result.data ?? null })
  }

  if (session.status !== 'active') {
    const learnedCount = session.completed_word_ids?.length ?? 0
    const nextCount = learningWords?.length ?? 0
    return (
      <div className="card mx-auto flex max-w-2xl flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">{session.status === 'completed' ? '🌱' : '⏹️'}</span>
        <p className="font-medium text-slate-700">
          {t(session.status === 'completed' ? 'learn.doneTitle' : 'learn.cancelledTitle')}
        </p>
        <p className="text-sm text-slate-400">
          {session.status === 'cancelled'
            ? t('learn.cancelledHint')
            : learnedCount > 0
              ? t('learn.doneHint', { n: learnedCount })
              : t('learn.doneNoneHint')}
        </p>
        {nextCount > 0 && (
          <button onClick={startNextBatch} className="btn-primary mt-3">
            {t('learn.nextBatch', { n: nextCount })}
          </button>
        )}
      </div>
    )
  }

  if (session.phase === 'summary') {
    const checkedCount = session.summary_items.filter((item) => checked[item.word.id] ?? true).length
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800">{t('learn.summaryTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('learn.summaryHint')}</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {session.summary_items.map(({ word, mistake_count }) => (
              <li key={word.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={checked[word.id] ?? true}
                  onChange={(e) => setChecked((cur) => ({ ...cur, [word.id]: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="flex-1 font-medium text-slate-800">{word.term}</span>
                <span className="text-sm text-slate-400">
                  {orderMeanings(word, meaningOrder)[0] ?? ''}
                </span>
                {mistake_count > 0 && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-500">
                    {t('learn.mistakes', { n: mistake_count })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {actionError && <ActionError message={actionError} />}
          <button
            onClick={markLearned}
            disabled={complete.isPending}
            className="btn-primary mt-4 w-full py-3"
          >
            {complete.isPending ? t('common.loading') : t('learn.markLearned', { n: checkedCount })}
          </button>
        </div>
      </div>
    )
  }

  const task = session.current_task
  if (!task) return <p className="text-slate-400">{t('common.loading')}</p>
  const completed = session.progress.completed_count + session.progress.cancelled_count

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${(completed / session.progress.total_count) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-slate-500 tabular-nums">
          {t('learn.progress', { done: completed, total: session.progress.total_count })}
        </span>
        <button
          onClick={cancelSession}
          disabled={cancel.isPending || answer.isPending}
          className="btn-ghost px-2 py-1 text-xs text-slate-400"
        >
          {t('learn.cancelSession')}
        </button>
      </div>

      <div className="card flex min-h-[18rem] flex-col p-8">
        {task.question_type === 'intro' && (
          <IntroStep
            word={task.word}
            langCode={targetLocale}
            orderedMeanings={orderMeanings(task.word, meaningOrder)}
            meaningLangs={course ? [course.native_language, ...course.helper_languages] : []}
            targetLang={course?.target_language}
            disabled={answer.isPending}
            onContinue={() => submitAnswer(task)}
          />
        )}

        {task.question_type === 'choice' && task.prompt && (
          <QuizFrame
            prompt={task.prompt}
            title={t('learn.chooseTitle')}
            feedback={feedback}
            onContinue={continueAfterFeedback}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {task.options.map((option) => (
                <button
                  key={option.word_id}
                  disabled={answer.isPending}
                  onClick={() => submitAnswer(task, { selected_word_id: option.word_id })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {option.term}
                </button>
              ))}
            </div>
          </QuizFrame>
        )}

        {task.question_type === 'typing' && task.prompt && (
          <QuizFrame
            prompt={task.prompt}
            title={t('learn.typeTitle')}
            feedback={feedback}
            onContinue={continueAfterFeedback}
          >
            <TypingInput
              key={task.attempt_token}
              disabled={answer.isPending}
              onSubmit={(submitted_answer) => submitAnswer(task, { submitted_answer })}
            />
          </QuizFrame>
        )}
        {actionError && <ActionError message={actionError} />}
      </div>
    </div>
  )
}

function IntroStep({
  word,
  langCode,
  orderedMeanings,
  meaningLangs,
  targetLang,
  disabled,
  onContinue,
}: {
  word: Word
  langCode: string
  orderedMeanings: string[]
  meaningLangs: LanguageBrief[]
  targetLang?: LanguageBrief
  disabled: boolean
  onContinue: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <WordCardContent
          word={word}
          orderedMeanings={orderedMeanings}
          revealed
          langCode={langCode}
          meaningLangs={meaningLangs}
          targetLang={targetLang}
        />
      </div>
      <button disabled={disabled} onClick={onContinue} className="btn-primary mt-6 w-full py-3">
        {disabled ? t('common.loading') : t('learn.continue')}
      </button>
    </div>
  )
}

function QuizFrame({
  title,
  prompt,
  feedback,
  onContinue,
  children,
}: {
  title: string
  prompt: string
  feedback: Feedback | null
  onContinue: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{prompt}</p>
      </div>
      <div className="mt-6">
        {feedback ? (
          <div className={`rounded-xl border p-4 text-center ${feedback.kind === 'accent' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
            <p className={`text-sm font-medium ${feedback.kind === 'accent' ? 'text-amber-700' : 'text-rose-600'}`}>
              {feedback.kind === 'accent' ? t('learn.accentHint') : t('learn.wrong')}{' '}
              <span className="font-semibold">{feedback.correct}</span>
            </p>
            <button onClick={onContinue} className="btn-primary mt-3 w-full py-2.5">
              {t('learn.next')}
            </button>
          </div>
        ) : children}
      </div>
    </div>
  )
}

function TypingInput({ disabled, onSubmit }: { disabled: boolean; onSubmit: (answer: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim() && !disabled) onSubmit(value)
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('learn.typePlaceholder')}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="input flex-1"
      />
      <button type="submit" disabled={disabled} className="btn-primary px-5">
        {disabled ? t('common.loading') : t('learn.check')}
      </button>
    </form>
  )
}

function ActionError({ message }: { message: string }) {
  return <p className="mt-4 rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-600">{message}</p>
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="card mx-auto max-w-2xl p-8 text-center">
      <p className="text-sm text-rose-600">{message}</p>
      <button onClick={onRetry} className="btn-primary mt-4">{t('learn.retry')}</button>
    </div>
  )
}

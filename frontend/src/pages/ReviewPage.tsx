import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { orderMeanings, WordCardContent } from '../components/WordCardContent'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useDueWords, useReviewWord } from '../hooks/useWords'
import type { Word } from '../types'

export function ReviewPage() {
  const { t } = useTranslation()
  const languageId = useLanguageId()
  const course = useCurrentCourse()
  // Anlamlari kurs dil sirasiyla goster (ana dil once).
  const meaningOrder = course?.native_language
    ? [course.native_language.id, ...course.helper_languages.map((h) => h.id)]
    : []
  const { data: due, isLoading } = useDueWords(languageId)
  const review = useReviewWord(languageId)

  // Kuyrugu bir kez sabitle: tekrar ettikce due listesi degisse de oturum bozulmaz.
  const [queue, setQueue] = useState<Word[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  useEffect(() => {
    if (queue === null && due) setQueue(due)
  }, [due, queue])

  if (isLoading || queue === null) {
    return <p className="text-slate-400">{t('common.loading')}</p>
  }

  if (queue.length === 0) {
    return (
      <div className="card mx-auto w-full max-w-2xl flex flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">🎉</span>
        <p className="font-medium text-slate-700">{t('review.empty')}</p>
        <p className="max-w-sm text-sm text-slate-400">{t('review.emptyHint')}</p>
      </div>
    )
  }

  if (idx >= queue.length) {
    return (
      <div className="card mx-auto w-full max-w-2xl flex flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">✅</span>
        <p className="font-medium text-slate-700">{t('review.finished')}</p>
        <p className="text-sm text-slate-400">{t('review.finishedHint', { n: reviewedCount })}</p>
      </div>
    )
  }

  const word = queue[idx]
  const total = queue.length
  const remaining = total - idx
  const orderedMeanings = orderMeanings(word, meaningOrder)

  function grade(result: 'known' | 'forgot') {
    review.mutate({ wordId: word.id, result })
    setReviewedCount((c) => c + 1)
    setRevealed(false)
    setIdx((i) => i + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Ilerleme */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${(idx / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-slate-500 tabular-nums">
          {t('review.remaining', { n: remaining })}
        </span>
      </div>

      {/* Kart */}
      <div className="card flex min-h-[18rem] flex-col p-8">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <WordCardContent
            word={word}
            orderedMeanings={orderedMeanings}
            revealed={revealed}
            langCode={course?.target_language.code}
            meaningLangs={course ? [course.native_language, ...course.helper_languages] : []}
            targetLang={course?.target_language}
          />
        </div>

        {/* Aksiyonlar */}
        <div className="mt-6">
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="btn-primary w-full py-3">
              {t('review.reveal')}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => grade('forgot')}
                className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-100 active:scale-[0.98]"
              >
                {t('review.forgot')}
              </button>
              <button
                onClick={() => grade('known')}
                className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.98]"
              >
                {t('review.known')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

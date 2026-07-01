import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
      <div className="card flex flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">🎉</span>
        <p className="font-medium text-slate-700">{t('review.empty')}</p>
        <p className="max-w-sm text-sm text-slate-400">{t('review.emptyHint')}</p>
      </div>
    )
  }

  if (idx >= queue.length) {
    return (
      <div className="card flex flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">✅</span>
        <p className="font-medium text-slate-700">{t('review.finished')}</p>
        <p className="text-sm text-slate-400">{t('review.finishedHint', { n: reviewedCount })}</p>
      </div>
    )
  }

  const word = queue[idx]
  const total = queue.length
  const remaining = total - idx
  const meaningById = new Map(word.meanings.map((m) => [m.language_id, m.value]))
  const orderedMeanings = meaningOrder
    .map((id) => meaningById.get(id))
    .filter((v): v is string => !!v && v.trim().length > 0)

  function grade(result: 'known' | 'forgot') {
    review.mutate({ wordId: word.id, result })
    setReviewedCount((c) => c + 1)
    setRevealed(false)
    setIdx((i) => i + 1)
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
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
          <div className="flex flex-wrap items-baseline justify-center gap-2">
            <span className="text-3xl font-semibold text-slate-900">{word.term}</span>
            {word.part_of_speech && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {t(`words.partsOfSpeech.${word.part_of_speech}`, { defaultValue: word.part_of_speech })}
              </span>
            )}
          </div>
          {(word.phonetic || word.phonetic_native) && (
            <div className="mt-1.5 text-sm text-slate-400">
              {[word.phonetic, word.phonetic_native].filter(Boolean).join(' · ')}
            </div>
          )}

          {revealed && (
            <div className="mt-5 w-full space-y-2 border-t border-slate-100 pt-5">
              {orderedMeanings.length > 0 && (
                <div className="text-lg text-slate-800">
                  {orderedMeanings[0]}
                  {orderedMeanings.length > 1 && (
                    <span className="text-slate-400"> · {orderedMeanings.slice(1).join(' · ')}</span>
                  )}
                </div>
              )}
              {word.definition_target && (
                <div className="text-sm italic text-slate-500">{word.definition_target}</div>
              )}
              {word.example_sentence && (
                <div className="mx-auto mt-2 max-w-md border-l-2 border-slate-200 pl-3 text-left text-sm">
                  <div className="text-slate-700">{word.example_sentence}</div>
                  {word.example_translation && (
                    <div className="text-slate-400">{word.example_translation}</div>
                  )}
                </div>
              )}
            </div>
          )}
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

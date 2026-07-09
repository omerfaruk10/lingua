import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { orderMeanings, WordCardContent } from '../components/WordCardContent'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useSetWordStatus, useWords } from '../hooks/useWords'
import type { LanguageBrief, Word } from '../types'

// Oturum basina calisilacak kelime sayisi (arastirma onerisi: 5-10).
const BATCH_SIZE = 5

// Egzersiz merdiveni: tanitim (kendi cumleni yaz) -> tanima (coktan secmeli)
// -> hatirlama (yazma). Yanlista bir basamak geriye, kuyruk sonuna.
type StepKind = 'intro' | 'choice' | 'typing'
interface Task {
  wordId: number
  step: StepKind
}
type Phase = 'session' | 'summary' | 'done'

interface Feedback {
  kind: 'accent' | 'wrong'
  correct: string
}

function normalize(s: string, locale: string): string {
  return s.trim().normalize('NFC').toLocaleLowerCase(locale)
}

// Aksan/diyakritik isaretlerini dusurur (perché -> perche).
function stripMarks(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Quiz sorusu: anlamlar (ana dil once) yoksa hedef dildeki tanim.
function promptFor(word: Word, meaningOrder: number[]): string | null {
  const meanings = orderMeanings(word, meaningOrder)
  if (meanings.length > 0) return meanings.join(' · ')
  return word.definition_target?.trim() || null
}

export function LearnPage() {
  const { t } = useTranslation()
  const languageId = useLanguageId()
  const course = useCurrentCourse()
  const targetLocale = course?.target_language.code ?? 'en'
  const meaningOrder = course?.native_language
    ? [course.native_language.id, ...course.helper_languages.map((h) => h.id)]
    : []

  const { data: learningWords, isLoading } = useWords(languageId, { status: 'learning' })
  // Celdirici havuzu: kursun tum kelimeleri (durumdan bagimsiz).
  const { data: allWords } = useWords(languageId)
  const setStatus = useSetWordStatus(languageId)

  const [phase, setPhase] = useState<Phase>('session')
  // Kuyruk mount'ta sabitlenir: oturum sirasinda liste degisse de akis bozulmaz.
  const [batch, setBatch] = useState<Word[] | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskSeq, setTaskSeq] = useState(0)
  const [mistakes, setMistakes] = useState<Record<number, number>>({})
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  // Bu oturumlarda mezun edilenler: stale cache'ten tekrar partiye girmesinler.
  const [graduatedIds, setGraduatedIds] = useState<Set<number>>(new Set())
  const [lastMarkedCount, setLastMarkedCount] = useState(0)

  useEffect(() => {
    if (batch === null && learningWords) {
      const pool = learningWords.filter((w) => !graduatedIds.has(w.id))
      setBatch(pool.slice(0, BATCH_SIZE))
      setTasks(pool.slice(0, BATCH_SIZE).map((w) => ({ wordId: w.id, step: 'intro' })))
    }
  }, [batch, learningWords, graduatedIds])

  const wordById = useMemo(
    () => new Map((batch ?? []).map((w) => [w.id, w])),
    [batch],
  )

  const current = tasks[0] ?? null
  const currentWord = current ? wordById.get(current.wordId) ?? null : null

  // Coktan secmeli secenekleri: gorev basina bir kez karistirilir.
  const choiceOptions = useMemo(() => {
    if (!current || current.step !== 'choice' || !currentWord) return []
    const seen = new Set([normalize(currentWord.term, targetLocale)])
    const candidates: string[] = []
    for (const w of allWords ?? []) {
      const key = normalize(w.term, targetLocale)
      if (seen.has(key)) continue
      seen.add(key)
      candidates.push(w.term)
    }
    const distractors = shuffle(candidates).slice(0, 3)
    return shuffle([currentWord.term, ...distractors])
    // taskSeq: ayni kelime kuyruga geri dondugunde secenekler yeniden karistirilsin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.wordId, current?.step, taskSeq, allWords, targetLocale])

  if (isLoading || batch === null) {
    return <p className="text-slate-400">{t('common.loading')}</p>
  }

  if (batch.length === 0) {
    return (
      <div className="card mx-auto w-full max-w-2xl flex flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">📚</span>
        <p className="font-medium text-slate-700">{t('learn.empty')}</p>
        <p className="max-w-sm text-sm text-slate-400">{t('learn.emptyHint')}</p>
      </div>
    )
  }

  const remainingIds = new Set(tasks.map((task) => task.wordId))
  const completedCount = batch.length - remainingIds.size

  function advance(nextTasks: Task[]) {
    setTasks(nextTasks)
    setTaskSeq((n) => n + 1)
    setFeedback(null)
    if (nextTasks.length === 0) {
      setChecked(Object.fromEntries(batch!.map((w) => [w.id, true])))
      setPhase('summary')
    }
  }

  function completeCurrent() {
    advance(tasks.slice(1))
  }

  function pushBack(step: StepKind) {
    if (!current) return
    advance([...tasks.slice(1), { wordId: current.wordId, step }])
  }

  function recordMistake(wordId: number) {
    setMistakes((m) => ({ ...m, [wordId]: (m[wordId] ?? 0) + 1 }))
  }

  // --- Adim islevleri ---

  function submitIntro() {
    if (!currentWord) return
    const quizzable = promptFor(currentWord, meaningOrder) !== null
    if (!quizzable) {
      completeCurrent() // soracak bir sey yok: kelime tanitimla tamamlanir
      return
    }
    const nextStep: StepKind = choicePoolExists() ? 'choice' : 'typing'
    advance([...tasks.slice(1), { wordId: currentWord.id, step: nextStep }])
  }

  function choicePoolExists(): boolean {
    if (!currentWord) return false
    const key = normalize(currentWord.term, targetLocale)
    return (allWords ?? []).some((w) => normalize(w.term, targetLocale) !== key)
  }

  function submitChoice(option: string) {
    if (!currentWord) return
    if (option === currentWord.term) {
      advance([...tasks.slice(1), { wordId: currentWord.id, step: 'typing' }])
    } else {
      recordMistake(currentWord.id)
      setFeedback({ kind: 'wrong', correct: currentWord.term })
    }
  }

  function submitTyping(answer: string) {
    if (!currentWord) return
    const given = normalize(answer, targetLocale)
    const expected = normalize(currentWord.term, targetLocale)
    if (given === expected) {
      completeCurrent()
    } else if (given && stripMarks(given) === stripMarks(expected)) {
      // Aksan farki: uyariyla dogru sayilir, kuyruga geri donmez.
      setFeedback({ kind: 'accent', correct: currentWord.term })
    } else {
      recordMistake(currentWord.id)
      setFeedback({ kind: 'wrong', correct: currentWord.term })
    }
  }

  function continueAfterFeedback() {
    if (!feedback || !current) return
    if (feedback.kind === 'accent') {
      completeCurrent() // dogru sayildi
    } else {
      // Yanlis: bir basamak geriye (choice), kuyruk sonuna.
      pushBack(current.step === 'typing' && choicePoolExists() ? 'choice' : current.step)
    }
  }

  async function markLearned() {
    const ids = batch!.filter((w) => checked[w.id]).map((w) => w.id)
    await Promise.all(ids.map((wordId) => setStatus.mutateAsync({ wordId, status: 'learned' })))
    setGraduatedIds((prev) => new Set([...prev, ...ids]))
    setLastMarkedCount(ids.length)
    setPhase('done')
  }

  function startNextBatch() {
    setPhase('session')
    setBatch(null) // effect taze veriyle yeni partiyi kurar
    setTasks([])
    setMistakes({})
    setChecked({})
    setFeedback(null)
  }

  // --- Ekranlar ---

  if (phase === 'summary') {
    const checkedCount = batch.filter((w) => checked[w.id]).length
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-800">{t('learn.summaryTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('learn.summaryHint')}</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {batch.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={!!checked[w.id]}
                  onChange={(e) => setChecked((c) => ({ ...c, [w.id]: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="flex-1 font-medium text-slate-800">{w.term}</span>
                <span className="text-sm text-slate-400">
                  {orderMeanings(w, meaningOrder)[0] ?? ''}
                </span>
                {(mistakes[w.id] ?? 0) > 0 && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-500">
                    {t('learn.mistakes', { n: mistakes[w.id] })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <button
            onClick={markLearned}
            disabled={setStatus.isPending}
            className="btn-primary mt-4 w-full py-3"
          >
            {t('learn.markLearned', { n: checkedCount })}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const nextCount = (learningWords ?? []).filter((w) => !graduatedIds.has(w.id)).length
    return (
      <div className="card mx-auto flex max-w-2xl flex-col items-center gap-2 border-dashed bg-white/50 p-12 text-center">
        <span className="text-4xl">🌱</span>
        <p className="font-medium text-slate-700">{t('learn.doneTitle')}</p>
        <p className="text-sm text-slate-400">
          {lastMarkedCount > 0
            ? t('learn.doneHint', { n: lastMarkedCount })
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

  if (!current || !currentWord) {
    return <p className="text-slate-400">{t('common.loading')}</p>
  }

  const prompt = promptFor(currentWord, meaningOrder)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Ilerleme */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${(completedCount / batch.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium text-slate-500 tabular-nums">
          {t('learn.progress', { done: completedCount, total: batch.length })}
        </span>
      </div>

      <div className="card flex min-h-[18rem] flex-col p-8">
        {current.step === 'intro' && (
          <IntroStep
            key={`${current.wordId}-${taskSeq}`}
            word={currentWord}
            langCode={targetLocale}
            orderedMeanings={orderMeanings(currentWord, meaningOrder)}
            meaningLangs={course ? [course.native_language, ...course.helper_languages] : []}
            targetLang={course?.target_language}
            onContinue={submitIntro}
          />
        )}

        {current.step === 'choice' && prompt && (
          <QuizFrame prompt={prompt} title={t('learn.chooseTitle')} feedback={feedback} onContinue={continueAfterFeedback}>
            <div className="grid gap-2 sm:grid-cols-2">
              {choiceOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => submitChoice(option)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]"
                >
                  {option}
                </button>
              ))}
            </div>
          </QuizFrame>
        )}

        {current.step === 'typing' && prompt && (
          <QuizFrame prompt={prompt} title={t('learn.typeTitle')} feedback={feedback} onContinue={continueAfterFeedback}>
            <TypingInput key={`${current.wordId}-${taskSeq}`} onSubmit={submitTyping} />
          </QuizFrame>
        )}
      </div>
    </div>
  )
}

// Tanitim: kart tam acik gosterilir, kullanici inceleyip devam eder.
function IntroStep({
  word,
  langCode,
  orderedMeanings,
  meaningLangs,
  targetLang,
  onContinue,
}: {
  word: Word
  langCode: string
  orderedMeanings: string[]
  meaningLangs: LanguageBrief[]
  targetLang?: LanguageBrief
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
      <button onClick={onContinue} className="btn-primary mt-6 w-full py-3">
        {t('learn.continue')}
      </button>
    </div>
  )
}

// Quiz adimlarinin ortak cercevesi: soru + icerik + (varsa) geri bildirim paneli.
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
          <div
            className={`rounded-xl border p-4 text-center ${
              feedback.kind === 'accent'
                ? 'border-amber-200 bg-amber-50'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                feedback.kind === 'accent' ? 'text-amber-700' : 'text-rose-600'
              }`}
            >
              {feedback.kind === 'accent' ? t('learn.accentHint') : t('learn.wrong')}{' '}
              <span className="font-semibold">{feedback.correct}</span>
            </p>
            <button onClick={onContinue} className="btn-primary mt-3 w-full py-2.5">
              {t('learn.next')}
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function TypingInput({ onSubmit }: { onSubmit: (answer: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit(value)
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('learn.typePlaceholder')}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="input flex-1"
      />
      <button type="submit" className="btn-primary px-5">
        {t('learn.check')}
      </button>
    </form>
  )
}

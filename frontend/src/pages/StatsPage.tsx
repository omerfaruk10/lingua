import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../components/Modal'
import { orderMeanings, WordCardContent } from '../components/WordCardContent'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useDailyActivity, useDailyStats } from '../hooks/useStats'
import { useWords } from '../hooks/useWords'
import type { DailyStat, Word } from '../types'

type View = 'month' | 'week' | 'day'

// ---- tarih yardimcilari (yerel) ----
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ogrenilen sayisina gore heatmap tonu (saydamlik degil, ayni rengin tonlari)
function shade(n: number): string {
  if (n <= 0) return 'bg-slate-100 text-slate-300'
  if (n <= 2) return 'bg-violet-100 text-violet-700'
  if (n <= 5) return 'bg-violet-300 text-violet-900'
  if (n <= 9) return 'bg-violet-500 text-white'
  return 'bg-violet-700 text-white'
}

export function StatsPage() {
  const { t, i18n } = useTranslation()
  const languageId = useLanguageId()
  const { data: stats, isLoading } = useDailyStats(languageId)
  const { data: words } = useWords(languageId)

  const [view, setView] = useState<View>('month')
  const today = new Date()
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(() => dayKey(today))
  const { data: activity } = useDailyActivity(languageId, selectedDay)

  const byDay = useMemo(() => {
    const m = new Map<string, DailyStat>()
    for (const s of stats ?? []) m.set(s.day, s)
    return m
  }, [stats])

  const allWords = words ?? []

  // ---- ozet ----
  const totalWords = allWords.length
  const learnedCount = allWords.filter((w) => w.learning_status === 'learned').length
  const weekLearned = useMemo(() => {
    let sum = 0
    for (let i = 0; i < 7; i++) sum += byDay.get(dayKey(addDays(today, -i)))?.learned ?? 0
    return sum
  }, [byDay])
  const streak = useMemo(() => {
    let s = 0
    for (let i = 0; ; i++) {
      const activity = byDay.get(dayKey(addDays(today, -i)))
      if ((activity?.learned ?? 0) > 0 || (activity?.reviewed ?? 0) > 0) s++
      else break
    }
    return s
  }, [byDay])

  // hafta basligi Pazartesi olacak sekilde gun adlari (yerel)
  const weekdayNames = useMemo(() => {
    const monday = new Date(2024, 0, 1) // Pazartesi
    return Array.from({ length: 7 }, (_, i) =>
      addDays(monday, i).toLocaleDateString(i18n.language, { weekday: 'short' }),
    )
  }, [i18n.language])

  function openDay(key: string) {
    setSelectedDay(key)
    setView('day')
  }

  if (isLoading) return <p className="text-slate-400">{t('common.loading')}</p>

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Ozet kartlari */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('stats.totalWords')} value={totalWords} />
        <StatCard label={t('stats.learnedThisWeek')} value={weekLearned} accent />
        <StatCard label={t('stats.learned')} value={learnedCount} />
        <StatCard label={t('stats.streak')} value={t('stats.streakDays', { n: streak })} />
      </div>

      {/* Gorunum secici */}
      <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-white/60 p-1 backdrop-blur-sm">
        {(['month', 'week', 'day'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 cursor-pointer rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
              view === v ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`stats.${v}`)}
          </button>
        ))}
      </div>

      <div key={view} className="reveal">
        {view === 'month' && (
          <MonthView
            month={month}
            setMonth={setMonth}
            byDay={byDay}
            weekdayNames={weekdayNames}
            locale={i18n.language}
            onPickDay={openDay}
          />
        )}
        {view === 'week' && (
          <WeekView byDay={byDay} weekdayNames={weekdayNames} onPickDay={openDay} t={t} />
        )}
        {view === 'day' && (
          <DayView
            dayKeyStr={selectedDay}
            stat={byDay.get(selectedDay)}
            locale={i18n.language}
            t={t}
            learnedWords={activity?.learned_words ?? []}
            reviewedWords={activity?.reviewed_words ?? []}
          />
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'ring-1 ring-violet-200' : ''}`}>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function MonthView({
  month,
  setMonth,
  byDay,
  weekdayNames,
  locale,
  onPickDay,
}: {
  month: Date
  setMonth: (d: Date) => void
  byDay: Map<string, DailyStat>
  weekdayNames: string[]
  locale: string
  onPickDay: (key: string) => void
}) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  // Pazartesi=0 olacak sekilde bos hucre sayisi
  const lead = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const monthLabel = month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonth(new Date(year, m - 1, 1))}
          className="btn-icon"
          aria-label="prev"
        >
          ‹
        </button>
        <span className="text-sm font-semibold capitalize text-slate-700">{monthLabel}</span>
        <button
          onClick={() => setMonth(new Date(year, m + 1, 1))}
          className="btn-icon"
          aria-label="next"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {weekdayNames.map((w) => (
          <div key={w} className="text-center text-[11px] font-medium uppercase text-slate-400">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d == null) return <div key={`b${i}`} />
          const key = dayKey(new Date(year, m, d))
          const learned = byDay.get(key)?.learned ?? 0
          const isToday = key === dayKey(new Date())
          return (
            <button
              key={key}
              onClick={() => onPickDay(key)}
              title={`${d}: ${learned}`}
              aria-current={isToday ? 'date' : undefined}
              className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition hover:ring-2 hover:ring-violet-300 ${shade(learned)} ${isToday ? 'outline-2 outline-offset-2 outline-violet-500' : ''}`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  byDay,
  weekdayNames,
  onPickDay,
  t,
}: {
  byDay: Map<string, DailyStat>
  weekdayNames: string[]
  onPickDay: (key: string) => void
  t: (k: string) => string
}) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i))
  const data = days.map((d) => {
    const s = byDay.get(dayKey(d))
    return { date: d, key: dayKey(d), learned: s?.learned ?? 0, reviewed: s?.reviewed ?? 0 }
  })
  const max = Math.max(1, ...data.map((d) => Math.max(d.learned, d.reviewed)))

  const W = 700
  const H = 220
  const top = 24
  const base = 168
  const chartH = base - top
  const col = W / 7
  const barW = 30
  const y = (v: number) => base - (v / max) * chartH
  const cx = (i: number) => col * i + col / 2

  const linePts = data.map((d, i) => `${cx(i)},${y(d.reviewed)}`).join(' ')

  return (
    <div className="card p-4">
      {/* Aciklama */}
      <div className="mb-2 flex justify-end gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> {t('stats.learned')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {t('stats.reviewed')}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {data.map((d, i) => {
          const h = base - y(d.learned)
          return (
            <g key={d.key} className="cursor-pointer" onClick={() => onPickDay(d.key)}>
              <rect x={cx(i) - barW / 2} y={y(d.learned)} width={barW} height={Math.max(0, h)} rx={6} fill="#8b5cf6" />
              {d.learned > 0 && (
                <text x={cx(i)} y={y(d.learned) - 6} textAnchor="middle" fontSize="13" fill="#7c3aed" fontWeight="600">
                  {d.learned}
                </text>
              )}
              <text x={cx(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="#94a3b8">
                {weekdayNames[(d.date.getDay() + 6) % 7]}
              </text>
            </g>
          )
        })}
        <polyline points={linePts} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={`c${d.key}`} cx={cx(i)} cy={y(d.reviewed)} r="3.5" fill="#10b981" />
        ))}
      </svg>
    </div>
  )
}

function DayView({
  dayKeyStr,
  stat,
  locale,
  t,
  learnedWords,
  reviewedWords,
}: {
  dayKeyStr: string
  stat: DailyStat | undefined
  locale: string
  t: (k: string) => string
  learnedWords: Word[]
  reviewedWords: Word[]
}) {
  const course = useCurrentCourse()
  const [detail, setDetail] = useState<Word | null>(null)
  const meaningOrder = course?.native_language
    ? [course.native_language.id, ...course.helper_languages.map((language) => language.id)]
    : []
  const learned = stat?.learned ?? 0
  const reviewed = stat?.reviewed ?? 0
  const label = new Date(`${dayKeyStr}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-semibold capitalize text-slate-800">{label}</span>
        <div className="flex gap-4 text-sm">
          <span className="text-sky-600">
            {learned} <span className="text-slate-400">{t('stats.learned')}</span>
          </span>
          <span className="text-emerald-600">
            {reviewed} <span className="text-slate-400">{t('stats.reviewed')}</span>
          </span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ActivityGroup title={t('stats.learnedToday')} words={learnedWords} onWord={setDetail} />
        <ActivityGroup title={t('stats.reviewedToday')} words={reviewedWords} onWord={setDetail} />
      </div>
      {detail && <Modal title={detail.term} onClose={() => setDetail(null)}><WordCardContent word={detail} orderedMeanings={orderMeanings(detail, meaningOrder)} revealed langCode={course?.target_language.code} meaningLangs={course ? [course.native_language, ...course.helper_languages] : []} targetLang={course?.target_language} /></Modal>}
    </div>
  )
}

function ActivityGroup({ title, words, onWord }: { title: string; words: Word[]; onWord: (word: Word) => void }) {
  return <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>{words.length ? <div className="grid gap-2">{words.map((word) => <button key={word.id} onClick={() => onWord(word)} className="flex cursor-pointer items-baseline gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50"><span className="font-medium text-slate-800">{word.term}</span>{word.meanings[0]?.value && <span className="truncate text-xs text-slate-400">{word.meanings[0].value}</span>}</button>)}</div> : <span className="text-sm text-slate-400">—</span>}</section>
}

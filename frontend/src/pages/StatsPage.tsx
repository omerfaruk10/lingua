import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useLanguageId } from '../components/WorkspaceLayout'
import { useDailyStats } from '../hooks/useStats'
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
// created_at naive-UTC string -> yerel gun anahtari
function utcToLocalKey(iso: string): string {
  return dayKey(new Date(iso.endsWith('Z') ? iso : `${iso}Z`))
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// eklenen sayisina gore heatmap tonu (saydamlik degil, ayni rengin tonlari)
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

  const byDay = useMemo(() => {
    const m = new Map<string, DailyStat>()
    for (const s of stats ?? []) m.set(s.day, s)
    return m
  }, [stats])

  const allWords = words ?? []

  // ---- ozet ----
  const totalWords = allWords.length
  const learnedCount = allWords.filter((w) => w.learning_status === 'learned').length
  const weekAdded = useMemo(() => {
    let sum = 0
    for (let i = 0; i < 7; i++) sum += byDay.get(dayKey(addDays(today, -i)))?.added ?? 0
    return sum
  }, [byDay])
  const streak = useMemo(() => {
    let s = 0
    for (let i = 0; ; i++) {
      const v = byDay.get(dayKey(addDays(today, -i)))?.added ?? 0
      if (v > 0) s++
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
    <div className="space-y-5">
      {/* Ozet kartlari */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('stats.totalWords')} value={totalWords} />
        <StatCard label={t('stats.thisWeek')} value={weekAdded} accent />
        <StatCard label={t('stats.learned')} value={learnedCount} />
        <StatCard label={t('stats.streak')} value={t('stats.streakDays', { n: streak })} />
      </div>

      {/* Gorunum secici */}
      <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-white/60 p-1 backdrop-blur-sm">
        {(['month', 'week', 'day'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
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
            words={allWords}
            locale={i18n.language}
            t={t}
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
          const added = byDay.get(key)?.added ?? 0
          return (
            <button
              key={key}
              onClick={() => onPickDay(key)}
              title={`${d}: ${added}`}
              className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium transition hover:ring-2 hover:ring-violet-300 ${shade(added)}`}
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
    return { date: d, key: dayKey(d), added: s?.added ?? 0, reviewed: s?.reviewed ?? 0 }
  })
  const max = Math.max(1, ...data.map((d) => Math.max(d.added, d.reviewed)))

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
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> {t('stats.added')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {t('stats.reviewed')}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {data.map((d, i) => {
          const h = base - y(d.added)
          return (
            <g key={d.key} className="cursor-pointer" onClick={() => onPickDay(d.key)}>
              <rect x={cx(i) - barW / 2} y={y(d.added)} width={barW} height={Math.max(0, h)} rx={6} fill="#8b5cf6" />
              {d.added > 0 && (
                <text x={cx(i)} y={y(d.added) - 6} textAnchor="middle" fontSize="13" fill="#7c3aed" fontWeight="600">
                  {d.added}
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
  words,
  locale,
  t,
}: {
  dayKeyStr: string
  stat: DailyStat | undefined
  words: Word[]
  locale: string
  t: (k: string) => string
}) {
  const added = stat?.added ?? 0
  const reviewed = stat?.reviewed ?? 0
  const dayWords = words.filter((w) => utcToLocalKey(w.created_at) === dayKeyStr)
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
          <span className="text-violet-600">
            +{added} <span className="text-slate-400">{t('stats.added')}</span>
          </span>
          <span className="text-emerald-600">
            {reviewed} <span className="text-slate-400">{t('stats.reviewed')}</span>
          </span>
        </div>
      </div>
      {dayWords.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{t('stats.dayEmpty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {dayWords.map((w) => (
            <li key={w.id} className="flex items-baseline gap-2 py-2">
              <span className="font-medium text-slate-800">{w.term}</span>
              {w.meanings[0]?.value && (
                <span className="text-sm text-slate-400">{w.meanings[0].value}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

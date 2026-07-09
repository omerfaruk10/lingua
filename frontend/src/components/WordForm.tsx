import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { wordsApi, type WordInput } from '../api/words'
import { langName } from '../lib/langName'
import type { LanguageBrief, WordLevel } from '../types'

// AI onerisinin ortak sekli — kelimenin TEK bir anlami/duyusu. Kelimenin >1
// yaygin anlami olabilecegi icin (play=oyun/oynamak) oneri her zaman bu sekilden
// bir LISTE olarak gelir; kullanici birini secer.
interface NormalizedSuggestion {
  phonetic?: string
  phonetic_native?: string
  pronunciation_note_native?: string
  part_of_speech?: string
  level?: WordLevel
  definition_target?: string
  example_sentence?: string
  example_translation?: string
  synonyms?: string
  antonyms?: string
  word_family?: string
  meaningsById: Record<number, string>
}

const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'numeral',
] as const

const WORD_LEVELS: WordLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// Anlam disindaki sabit alanlar. Anlam alanlari kursun dillerine gore uretilir.
type ScalarField =
  | 'term'
  | 'part_of_speech'
  | 'level'
  | 'phonetic'
  | 'phonetic_native'
  | 'pronunciation_note_native'
  | 'definition_target'
  | 'example_sentence'
  | 'example_translation'
  | 'synonyms'
  | 'antonyms'
  | 'word_family'

type ScalarValues = Record<ScalarField, string>

function PosCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const label = value ? t(`words.partsOfSpeech.${value}`, { defaultValue: value }) : ''

  const filtered = PARTS_OF_SPEECH.filter((pos) =>
    t(`words.partsOfSpeech.${pos}`).toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function openDropdown() {
    setOpen(true)
    setQuery(label)
    setTimeout(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.select() }
    }, 0)
  }

  function select(pos: string) {
    onChange(pos)
    setOpen(false)
    setQuery('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={ref} className="relative">
      {open ? (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder=""
          className="input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); select(filtered[0]) }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={openDropdown}
          className="input flex min-h-[2.875rem] items-center justify-between text-left w-full cursor-text"
        >
          <span className="text-slate-800">{label || ' '}</span>
          {value && (
            <span
              onClick={clear}
              className="text-slate-400 hover:text-slate-600 px-0.5 leading-none text-base cursor-pointer"
              role="button"
              aria-label="Temizle"
            >
              ×
            </span>
          )}
        </button>
      )}

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.map((pos) => (
            <li
              key={pos}
              onMouseDown={() => select(pos)}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-violet-50 hover:text-violet-700 transition-colors ${
                pos === value ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-700'
              }`}
            >
              {t(`words.partsOfSpeech.${pos}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LevelCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = WORD_LEVELS.filter((level) =>
    level.toLowerCase().includes(query.trim().toLowerCase())
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function openDropdown() {
    setOpen(true)
    setQuery(value)
    setTimeout(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.select() }
    }, 0)
  }

  function select(level: WordLevel) {
    onChange(level)
    setOpen(false)
    setQuery('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={ref} className="relative">
      {open ? (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder=""
          className="input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            if (e.key === 'Enter' && filtered.length > 0) {
              e.preventDefault()
              select(filtered[0])
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={openDropdown}
          className="input flex min-h-[2.875rem] w-full cursor-text items-center justify-between text-left"
        >
          <span className="text-slate-800">{value || '\u00a0'}</span>
          {value && (
          <span
            onClick={clear}
            className="px-0.5 text-base leading-none text-slate-400 hover:text-slate-600"
            role="button"
            aria-label="Temizle"
          >
            x
          </span>
          )}
        </button>
      )}

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.map((level) => (
            <li
              key={level}
              onMouseDown={() => select(level)}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-violet-50 hover:text-violet-700 ${
                level === value ? 'bg-violet-50 font-medium text-violet-700' : 'text-slate-700'
              }`}
            >
              {level}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function emptyScalars(): ScalarValues {
  return {
    term: '', part_of_speech: '', level: '', phonetic: '', phonetic_native: '',
    pronunciation_note_native: '',
    definition_target: '', example_sentence: '', example_translation: '',
    synonyms: '', antonyms: '', word_family: '',
  }
}

export function WordForm({
  initial,
  courseId,
  nativeLang,
  helperLangs,
  targetLang,
  title,
  submitLabel,
  submitting,
  bare,
  showStartLearning,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<WordInput>
  // Kurs id'si: AI onerisi (backend) icin gerekir.
  courseId: number
  nativeLang: LanguageBrief
  helperLangs: LanguageBrief[]
  targetLang: LanguageBrief
  title?: string
  submitLabel: string
  submitting?: boolean
  bare?: boolean
  // Sadece ekleme akisinda: "ogrenmeye basla" anahtari gosterilir.
  showStartLearning?: boolean
  onSubmit: (data: WordInput, startLearning: boolean) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()

  // Anlam alanlari: once ana dil, sonra yardimci diller.
  const meaningLangs: LanguageBrief[] = [nativeLang, ...helperLangs]

  const [scalars, setScalars] = useState<ScalarValues>(() => {
    const s = emptyScalars()
    if (initial) {
      for (const k of Object.keys(s) as ScalarField[]) {
        s[k] = (initial[k] as string | null | undefined) ?? ''
      }
    }
    return s
  })

  // Anlam degerleri language_id -> metin.
  const [meanings, setMeanings] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {}
    for (const lang of meaningLangs) {
      m[lang.id] = initial?.meanings?.find((x) => x.language_id === lang.id)?.value ?? ''
    }
    return m
  })

  const [startLearning, setStartLearning] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestNote, setSuggestNote] = useState<'ai' | 'none' | null>(null)
  const [suggestedModel, setSuggestedModel] = useState<string | null>(null)
  const [suggestedSource, setSuggestedSource] = useState<string | null>(null)
  // Kelimenin >1 yaygin anlami varsa secim paneli icin bekleyen liste.
  const [senseChoices, setSenseChoices] = useState<NormalizedSuggestion[] | null>(null)
  // Son onerinin doldurdugu degerler: alan hala bu degeri tasiyorsa "kullanici
  // yazmadi" demektir ve yeni kelimenin onerisi uzerine yazabilir (bayat oneri bug'i).
  const lastSuggestedRef = useRef<Partial<Record<string, string>>>({})
  // Son onerinin hangi kelime icin oldugunu tutar — kelime degisince tum alanlar ezilir.
  const lastSuggestedTermRef = useRef<string>('')

  function setScalar(name: ScalarField, value: string) {
    setScalars((v) => ({ ...v, [name]: value }))
  }

function formatText(text: string | undefined, isSentence: boolean): string | undefined {
  if (!text) return text
  let t = text.trim()
  if (!t) return t
  t = t.charAt(0).toUpperCase() + t.slice(1)
  if (isSentence && !/[.!?]$/.test(t)) {
    t += '.'
  }
  return t
}

  // Onceki oneriden kalmis (elle degistirilmemis) alani ortak sekle donusturur.
  function applySuggestion(s: NormalizedSuggestion) {
    const prev = lastSuggestedRef.current
    const applied: Record<string, string> = {}
    // Kelime degistiyse tum alanlar uzerine yazilmali
    const termChanged = scalars.term.trim().toLowerCase() !== lastSuggestedTermRef.current.toLowerCase()
    const canFill = (current: string, key: string) =>
      termChanged || !current.trim() || current === prev[key]

    setScalars((v) => {
      const next = { ...v }
      
      // Kullanicinin girdigi kelimeyi her zaman kucuk harfe cevir (kullanici istegi)
      if (next.term && next.term.length > 0) {
        next.term = next.term.toLowerCase()
      }

      const fields = [
        ['phonetic', s.phonetic],
        ['phonetic_native', s.phonetic_native],
        ['pronunciation_note_native', formatText(s.pronunciation_note_native, true)],
        ['part_of_speech', s.part_of_speech],
        ['level', s.level],
        ['definition_target', formatText(s.definition_target, true)],
        ['example_sentence', formatText(s.example_sentence, true)],
        ['example_translation', formatText(s.example_translation, true)],
        ['synonyms', s.synonyms],
        ['antonyms', s.antonyms],
        ['word_family', s.word_family],
      ] as const
      for (const [key, val] of fields) {
        if (canFill(v[key], key as string)) {
          next[key] = val ?? (v[key] === prev[key] ? '' : v[key])
          if (val) applied[key] = val
        }
      }
      return next
    })

    setMeanings((m) => {
      const next = { ...m }
      for (const lang of meaningLangs) {
        const key = `meaning:${lang.id}`
        const cur = next[lang.id] ?? ''
        if (!canFill(cur, key)) continue
        const val = formatText(s.meaningsById[lang.id], false)
        next[lang.id] = val ?? (cur === prev[key] ? '' : cur)
        if (val) applied[key] = val
      }
      return next
    })

    lastSuggestedRef.current = applied
    lastSuggestedTermRef.current = scalars.term.trim()
  }

  // Bir anlami uygular; eger AI onerisiyse (2. asama) detaylari ceker.
  async function chooseSense(s: NormalizedSuggestion, note: 'ai') {
    setSenseChoices(null)
    
    if (note === 'ai') {
      try {
        setSuggesting(true)
        const details = await wordsApi.suggestDetails(courseId, {
          term: scalars.term.trim(),
          part_of_speech: s.part_of_speech,
          meaning: s.meaningsById[nativeLang.id] || Object.values(s.meaningsById)[0] || '',
        })
        s = {
          ...s,
          phonetic: details.phonetic ?? undefined,
          phonetic_native: details.phonetic_native ?? undefined,
          pronunciation_note_native: details.pronunciation_note_native ?? undefined,
          level: details.level ?? undefined,
          definition_target: details.definition_target ?? undefined,
          example_sentence: details.example_sentence ?? undefined,
          example_translation: details.example_translation ?? undefined,
          synonyms: details.synonyms ?? undefined,
          antonyms: details.antonyms ?? undefined,
          word_family: details.word_family ?? undefined,
        }
        if (details.model) setSuggestedModel(details.model)
        if (details.source) setSuggestedSource(details.source)
      } catch (e) {
        // Detay cekilemezse bos uygulansin veya hata gosterilsin
        console.error("AI details error:", e)
      } finally {
        setSuggesting(false)
      }
    }
    
    applySuggestion(s)
    setSuggestNote(note)
  }

  // ✨ Oneri: AI (backend/Gemini, tum alanlar + tum diller + en fazla 5
  // yaygin anlam). Kelimenin tek anlami varsa dogrudan uygulanir; 
  // birden fazlaysa kullanici secer (orn. "play" -> isim/oyun ya da fiil/oynamak).
  async function suggest() {
    const term = scalars.term.trim()
    if (!term || suggesting) return
    setSuggesting(true)
    setSuggestNote(null)
    setSuggestedModel(null)
    setSuggestedSource(null)
    setSenseChoices(null)

    try {
      const ai = await wordsApi.suggest(courseId, term)
      const senses: NormalizedSuggestion[] = ai.senses.map((sense) => ({
        part_of_speech: sense.part_of_speech ?? undefined,
        meaningsById: sense.meanings ?? {},
      }))
      if (ai.model) setSuggestedModel(ai.model)
      if (ai.source) setSuggestedSource(ai.source)
      if (senses.length === 1) {
        await chooseSense(senses[0], 'ai')
      } else if (senses.length > 1) {
        setSenseChoices(senses)
        setSuggesting(false)
      } else {
        throw new Error('No AI senses')
      }
      return
    } catch (e) {
      setSuggestNote('none')
    }
    setSuggesting(false)
  }

  // Secim panelinde gosterilecek kisa etiket: "tur — anlam/tanim ozeti".
  function sensePreview(s: NormalizedSuggestion): { pos: string; gloss: string } {
    const pos = s.part_of_speech
      ? t(`words.partsOfSpeech.${s.part_of_speech}`, { defaultValue: s.part_of_speech })
      : t('words.suggestSenseUnknownPos')
    const gloss =
      s.meaningsById[nativeLang.id] ?? Object.values(s.meaningsById)[0] ?? s.definition_target ?? ''
    return { pos, gloss }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!scalars.term.trim()) return
    const payload: WordInput = { term: scalars.term.trim() }
    const scalarKeys: Exclude<ScalarField, 'term' | 'level'>[] = [
      'part_of_speech', 'phonetic', 'phonetic_native',
      'pronunciation_note_native',
      'definition_target', 'example_sentence', 'example_translation',
      'synonyms', 'antonyms', 'word_family'
    ]
    for (const k of scalarKeys) payload[k] = scalars[k].trim() || null
    payload.level = WORD_LEVELS.includes(scalars.level as WordLevel)
      ? scalars.level as WordLevel
      : null
    payload.meanings = meaningLangs.map((lang) => ({
      language_id: lang.id,
      value: (meanings[lang.id] ?? '').trim() || null,
    }))
    onSubmit(payload, startLearning)
  }

  const nativeDisplay = langName(t, nativeLang.code, nativeLang.native_name)
  const targetDisplay = langName(t, targetLang.code, targetLang.native_name)

  function meaningLabel(lang: LanguageBrief, isNative: boolean): string {
    return isNative
      ? t('words.meaningIn', { lang: nativeDisplay })
      : langName(t, lang.code, lang.name)
  }

  const inner = (
    <>
      {title && <h2 className="mb-4 font-semibold text-slate-800">{title}</h2>}
      <div className="grid gap-3 sm:grid-cols-6">
        {/* Kelime + tur */}
        <label className="block sm:col-span-3">
          <span className="field-label">
            {t('words.fields.term')}
            <span className="text-violet-500"> *</span>
          </span>
          <div className="flex gap-2">
            <input
              value={scalars.term}
              onChange={(e) => {
                setScalar('term', e.target.value)
                setSuggestNote(null)
                setSuggestedModel(null)
                setSuggestedSource(null)
                setSenseChoices(null)
              }}
              className="input"
            />
            <button
              type="button"
              onClick={suggest}
              disabled={!scalars.term.trim() || suggesting}
              className="btn-ghost h-[2.875rem] w-[3.25rem] shrink-0 overflow-hidden px-0"
              title={t('words.suggest')}
              aria-label={t('words.suggest')}
            >
              {suggesting ? (
                <span className="ai-suggest-loader" aria-hidden="true">
                  <span className="ai-suggest-trail">
                    <span />
                    <span />
                    <span />
                  </span>
                </span>
              ) : (
                <span aria-hidden="true">✨</span>
              )}
            </button>
          </div>
          {suggestNote && (
            <span
              className={`mt-1 block text-xs ${
                suggestNote === 'none' ? 'text-rose-500' : 'text-violet-600'
              }`}
            >
              {suggestNote === 'ai'
                ? t('words.suggestDoneAi') + (
                  suggestedModel ? ` (${suggestedModel}${suggestedSource === 'cache' ? ' - cache' : ''})` : ''
                )
                : t('words.suggestNone')}
            </span>
          )}
        </label>
        <div className="block sm:col-span-2">
          <span className="field-label cursor-default">{t('words.fields.part_of_speech')}</span>
          <PosCombobox value={scalars.part_of_speech} onChange={(v) => setScalar('part_of_speech', v)} />
        </div>
        <label className="block sm:col-span-1">
          <span className="field-label">{t('words.fields.level')}</span>
          <LevelCombobox value={scalars.level} onChange={(v) => setScalar('level', v)} />
        </label>

        {/* Okunuslar */}
        <label className="block sm:col-span-3">
          <span className="field-label">{t('words.fields.phonetic')}</span>
          <input
            value={scalars.phonetic}
            onChange={(e) => setScalar('phonetic', e.target.value)}
            className="input"
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="field-label">{t('words.readingIn', { lang: nativeDisplay })}</span>
          <input
            value={scalars.phonetic_native}
            onChange={(e) => setScalar('phonetic_native', e.target.value)}
            className="input"
          />
        </label>

        <label className="block sm:col-span-6">
          <span className="field-label">{t('words.fields.pronunciationNote')}</span>
          <textarea
            value={scalars.pronunciation_note_native}
            onChange={(e) => setScalar('pronunciation_note_native', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>

        {/* Anlamlar: ana dil + yardimci diller */}
        {meaningLangs.map((lang, i) => (
          <label key={lang.id} className="block sm:col-span-3">
            <span className="field-label">{meaningLabel(lang, i === 0)}</span>
            <input
              value={meanings[lang.id] ?? ''}
              onChange={(e) => setMeanings((m) => ({ ...m, [lang.id]: e.target.value }))}
              className="input"
            />
          </label>
        ))}

        {/* Tanim + ornek */}
        <label className="block sm:col-span-6">
          <span className="field-label">{t('words.definitionIn', { lang: targetDisplay })}</span>
          <textarea
            value={scalars.definition_target}
            onChange={(e) => setScalar('definition_target', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>
        
        {/* Es anlam / Zit anlam */}
        <label className="block sm:col-span-3">
          <span className="field-label">{t('words.fields.synonyms')}</span>
          <input
            value={scalars.synonyms}
            onChange={(e) => setScalar('synonyms', e.target.value)}
            className="input"
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="field-label">{t('words.fields.antonyms')}</span>
          <input
            value={scalars.antonyms}
            onChange={(e) => setScalar('antonyms', e.target.value)}
            className="input"
          />
        </label>

        <label className="block sm:col-span-6">
          <span className="field-label">{t('words.fields.wordFamily')}</span>
          <textarea
            value={scalars.word_family}
            onChange={(e) => setScalar('word_family', e.target.value)}
            rows={5}
            className="input resize-none overflow-y-auto"
          />
        </label>

        <label className="block sm:col-span-6">
          <span className="field-label">{t('words.fields.example_sentence')}</span>
          <textarea
            value={scalars.example_sentence}
            onChange={(e) => setScalar('example_sentence', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>
        <label className="block sm:col-span-6">
          <span className="field-label">{t('words.translationIn', { lang: nativeDisplay })}</span>
          <textarea
            value={scalars.example_translation}
            onChange={(e) => setScalar('example_translation', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>

      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            {t('common.cancel')}
          </button>
        )}
        {showStartLearning && (
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={startLearning}
              onChange={(e) => setStartLearning(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            {t('words.fields.startLearning')}
          </label>
        )}
      </div>
    </>
  )

  return (
    <>
      {bare ? <form onSubmit={submit}>{inner}</form> : <form onSubmit={submit} className="card p-5">{inner}</form>}
      {senseChoices && (
        <SensePickerOverlay
          term={scalars.term}
          senses={senseChoices}
          preview={sensePreview}
          onClose={() => setSenseChoices(null)}
          onChoose={(s) => chooseSense(s, 'ai')}
        />
      )}
    </>
  )
}

// Kelimenin birden fazla yaygin anlami varsa: odaklanmis, karartilmis, animasyonlu
// bir katmanda secim sunar (Modal.tsx'teki animate-overlay/animate-panel deseniyle
// tutarli). WordForm zaten bir Modal icinde acilabildigi icin bu ayri bir portal'a
// render olur (portal-icinde-portal calisir, en son render eden ustte kalir).
function SensePickerOverlay({
  term,
  senses,
  preview,
  onClose,
  onChoose,
}: {
  term: string
  senses: NormalizedSuggestion[]
  preview: (s: NormalizedSuggestion) => { pos: string; gloss: string }
  onClose: () => void
  onChoose: (s: NormalizedSuggestion) => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="animate-overlay absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-panel relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-violet-900/10"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              {t('words.suggestPickSense')}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">{term}</p>
          </div>
          <button onClick={onClose} className="btn-icon -mr-1.5" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto p-3">
          {senses.map((s, i) => {
            const { pos, gloss } = preview(s)
            return (
              <li
                key={i}
                style={{ animationDelay: `${i * 35}ms` }}
                className="animate-panel"
              >
                <button
                  type="button"
                  onClick={() => onChoose(s)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_12px_24px_-12px_rgba(124,108,240,0.30)] active:scale-[0.98]"
                >
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 group-hover:bg-violet-100 group-hover:text-violet-700">
                    {pos}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {gloss || term}
                  </span>
                  <span className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-400">
                    →
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}

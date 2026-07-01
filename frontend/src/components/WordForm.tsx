import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { WordInput } from '../api/words'
import { langName } from '../lib/langName'
import type { LanguageBrief } from '../types'

const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'numeral',
] as const

// Anlam disindaki sabit alanlar. Anlam alanlari kursun dillerine gore uretilir.
type ScalarField =
  | 'term'
  | 'part_of_speech'
  | 'phonetic'
  | 'phonetic_native'
  | 'definition_target'
  | 'example_sentence'
  | 'example_translation'

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

function emptyScalars(): ScalarValues {
  return {
    term: '', part_of_speech: '', phonetic: '', phonetic_native: '',
    definition_target: '', example_sentence: '', example_translation: '',
  }
}

export function WordForm({
  initial,
  nativeLang,
  helperLangs,
  targetLang,
  title,
  submitLabel,
  submitting,
  bare,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<WordInput>
  nativeLang: LanguageBrief
  helperLangs: LanguageBrief[]
  targetLang: LanguageBrief
  title?: string
  submitLabel: string
  submitting?: boolean
  bare?: boolean
  onSubmit: (data: WordInput) => void
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

  function setScalar(name: ScalarField, value: string) {
    setScalars((v) => ({ ...v, [name]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!scalars.term.trim()) return
    const payload: WordInput = { term: scalars.term.trim() }
    const scalarKeys: Exclude<ScalarField, 'term'>[] = [
      'part_of_speech', 'phonetic', 'phonetic_native',
      'definition_target', 'example_sentence', 'example_translation',
    ]
    for (const k of scalarKeys) payload[k] = scalars[k].trim() || null
    payload.meanings = meaningLangs.map((lang) => ({
      language_id: lang.id,
      value: (meanings[lang.id] ?? '').trim() || null,
    }))
    onSubmit(payload)
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
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Kelime + tur */}
        <label className="block">
          <span className="field-label">
            {t('words.fields.term')}
            <span className="text-violet-500"> *</span>
          </span>
          <input
            value={scalars.term}
            onChange={(e) => setScalar('term', e.target.value)}
            className="input"
          />
        </label>
        <div className="block">
          <span className="field-label cursor-default">{t('words.fields.part_of_speech')}</span>
          <PosCombobox value={scalars.part_of_speech} onChange={(v) => setScalar('part_of_speech', v)} />
        </div>

        {/* Okunuslar */}
        <label className="block">
          <span className="field-label">{t('words.fields.phonetic')}</span>
          <input
            value={scalars.phonetic}
            onChange={(e) => setScalar('phonetic', e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="field-label">{t('words.readingIn', { lang: nativeDisplay })}</span>
          <input
            value={scalars.phonetic_native}
            onChange={(e) => setScalar('phonetic_native', e.target.value)}
            className="input"
          />
        </label>

        {/* Anlamlar: ana dil + yardimci diller */}
        {meaningLangs.map((lang, i) => (
          <label key={lang.id} className="block">
            <span className="field-label">{meaningLabel(lang, i === 0)}</span>
            <input
              value={meanings[lang.id] ?? ''}
              onChange={(e) => setMeanings((m) => ({ ...m, [lang.id]: e.target.value }))}
              className="input"
            />
          </label>
        ))}

        {/* Tanim + ornek */}
        <label className="block sm:col-span-2">
          <span className="field-label">{t('words.definitionIn', { lang: targetDisplay })}</span>
          <textarea
            value={scalars.definition_target}
            onChange={(e) => setScalar('definition_target', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{t('words.fields.example_sentence')}</span>
          <textarea
            value={scalars.example_sentence}
            onChange={(e) => setScalar('example_sentence', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{t('words.translationIn', { lang: nativeDisplay })}</span>
          <textarea
            value={scalars.example_translation}
            onChange={(e) => setScalar('example_translation', e.target.value)}
            rows={3}
            className="input resize-none overflow-y-auto"
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            {t('common.cancel')}
          </button>
        )}
      </div>
    </>
  )

  return bare ? (
    <form onSubmit={submit}>{inner}</form>
  ) : (
    <form onSubmit={submit} className="card p-5">{inner}</form>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { WordInput } from '../api/words'

type FieldName = keyof Omit<WordInput, never>

const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'numeral',
] as const

const FIELDS: { name: FieldName; required?: boolean; multiline?: boolean; wide?: boolean }[] = [
  { name: 'term', required: true },
  { name: 'part_of_speech' },
  { name: 'phonetic' },
  { name: 'phonetic_tr' },
  { name: 'meaning_native' },
  { name: 'meaning_english' },
  { name: 'definition_target', multiline: true, wide: true },
  { name: 'example_sentence', multiline: true, wide: true },
  { name: 'example_translation', multiline: true, wide: true },
]

type FormValues = Record<FieldName, string>

function toForm(initial?: Partial<WordInput>): FormValues {
  const o = {} as FormValues
  for (const f of FIELDS) o[f.name] = (initial?.[f.name] as string | null | undefined) ?? ''
  return o
}

function PosCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const label = value ? t(`words.partsOfSpeech.${value}`) : ''

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
          className="input flex items-center justify-between text-left w-full cursor-text"
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

export function WordForm({
  initial,
  title,
  submitLabel,
  submitting,
  bare,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<WordInput>
  title?: string
  submitLabel: string
  submitting?: boolean
  bare?: boolean
  onSubmit: (data: WordInput) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<FormValues>(() => toForm(initial))

  function set(name: FieldName, value: string) {
    setValues((v) => ({ ...v, [name]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.term.trim()) return
    const payload = { term: values.term.trim() } as WordInput
    for (const f of FIELDS) {
      if (f.name === 'term') continue
      payload[f.name] = values[f.name].trim() || null
    }
    onSubmit(payload)
  }

  const inner = (
    <>
      {title && <h2 className="mb-4 font-semibold text-slate-800">{title}</h2>}
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const Wrapper = f.name === 'part_of_speech' ? 'div' : 'label'
          return (
          <Wrapper key={f.name} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
            <span className={`field-label${f.name === 'part_of_speech' ? ' cursor-default' : ''}`}>
              {t(`words.fields.${f.name}`)}
              {f.required && <span className="text-violet-500"> *</span>}
            </span>
            {f.name === 'part_of_speech' ? (
              <PosCombobox value={values[f.name]} onChange={(v) => set(f.name, v)} />
            ) : f.multiline ? (
              <textarea
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                rows={3}
                className="input resize-none overflow-y-auto"
              />
            ) : (
              <input
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                className="input"
              />
            )}
          </Wrapper>
          )
        })}
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

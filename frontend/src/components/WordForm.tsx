import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { WordInput } from '../api/words'

type FieldName = keyof Omit<WordInput, never>

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

export function WordForm({
  initial,
  title,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<WordInput>
  title: string
  submitLabel: string
  submitting?: boolean
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
      // bos string -> null: opsiyonel alanlar duzenlemede temizlenebilsin
      payload[f.name] = values[f.name].trim() || null
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <h2 className="mb-4 font-semibold text-slate-800">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.name} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
            <span className="field-label">
              {t(`words.fields.${f.name}`)}
              {f.required && <span className="text-violet-500"> *</span>}
            </span>
            {f.multiline ? (
              <textarea
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                rows={2}
                className="input resize-y"
              />
            ) : (
              <input
                value={values[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
                className="input"
              />
            )}
          </label>
        ))}
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
    </form>
  )
}

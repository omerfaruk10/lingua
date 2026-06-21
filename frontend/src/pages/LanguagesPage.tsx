import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useCreateLanguage, useDeleteLanguage, useLanguages } from '../hooks/useLanguages'
import { setSelectedLanguageId } from '../lib/selectedLanguage'

const EMPTY = { code: '', name: '', native_name: '' }

export function LanguagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: languages, isLoading } = useLanguages()
  const createLang = useCreateLanguage()
  const deleteLang = useDeleteLanguage()
  const [form, setForm] = useState(EMPTY)

  function open(id: number) {
    setSelectedLanguageId(id)
    navigate(`/lang/${id}/topics`)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim() || !form.native_name.trim()) return
    createLang.mutate(form, { onSuccess: () => setForm(EMPTY) })
  }

  function remove(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (confirm(t('languages.deleteConfirm'))) deleteLang.mutate(id)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('languages.title')}
        </h1>
        <p className="mt-1 text-slate-500">{t('languages.subtitle')}</p>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : languages && languages.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {languages.map((lang) => (
            <li
              key={lang.id}
              onClick={() => open(lang.id)}
              className="card group flex cursor-pointer items-center gap-3.5 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_16px_32px_-16px_rgba(124,108,240,0.30)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-sm font-semibold uppercase text-violet-600">
                {lang.code.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-800">{lang.name}</div>
                <div className="truncate text-sm text-slate-500">{lang.native_name}</div>
              </div>
              <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500">
                →
              </span>
              <button
                onClick={(e) => remove(e, lang.id)}
                className="btn-icon-danger opacity-0 transition group-hover:opacity-100"
                title={t('common.delete')}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">🌍</span>
          <p className="text-slate-400">{t('languages.empty')}</p>
        </div>
      )}

      {/* Yeni dil ekleme */}
      <form onSubmit={submit} className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-800">{t('languages.addTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t('languages.code')}
            hint={t('languages.codeHint')}
            value={form.code}
            onChange={(v) => setForm((f) => ({ ...f, code: v }))}
          />
          <Field
            label={t('languages.name')}
            hint={t('languages.nameHint')}
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          <Field
            label={t('languages.nativeName')}
            hint={t('languages.nativeNameHint')}
            value={form.native_name}
            onChange={(v) => setForm((f) => ({ ...f, native_name: v }))}
          />
        </div>
        {createLang.isError && (
          <p className="mt-3 text-sm text-red-500">{(createLang.error as Error).message}</p>
        )}
        <button type="submit" disabled={createLang.isPending} className="btn-primary mt-4">
          {t('languages.create')}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={hint} className="input" />
    </label>
  )
}

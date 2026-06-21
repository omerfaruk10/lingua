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

  function remove(id: number) {
    if (confirm(t('languages.deleteConfirm'))) deleteLang.mutate(id)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t('languages.title')}</h1>
        <p className="mt-1 text-slate-500">{t('languages.subtitle')}</p>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : languages && languages.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {languages.map((lang) => (
            <li
              key={lang.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-300"
            >
              <button onClick={() => open(lang.id)} className="flex-1 text-left">
                <div className="font-semibold text-slate-800">{lang.name}</div>
                <div className="text-sm text-slate-500">
                  {lang.native_name} · <span className="uppercase">{lang.code}</span>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => open(lang.id)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
                >
                  {t('languages.open')}
                </button>
                <button
                  onClick={() => remove(lang.id)}
                  className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
                  title={t('common.delete')}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
          {t('languages.empty')}
        </p>
      )}

      {/* Yeni dil ekleme */}
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <p className="mt-3 text-sm text-red-600">{(createLang.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={createLang.isPending}
          className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
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
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      />
    </label>
  )
}

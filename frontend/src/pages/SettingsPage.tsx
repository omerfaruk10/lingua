import { useTranslation } from 'react-i18next'

import { setUiLang, SUPPORTED_LANGS, type UiLang } from '../i18n'

const LABEL_KEY: Record<UiLang, string> = { en: 'settings.english', tr: 'settings.turkish' }

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const current = i18n.language as UiLang

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('settings.title')}</h1>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold text-slate-800">{t('settings.uiLanguage')}</h2>
        <div className="flex gap-2">
          {SUPPORTED_LANGS.map((lang) => (
            <button
              key={lang}
              onClick={() => setUiLang(lang)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition active:scale-[0.98] ${
                current === lang
                  ? 'border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white hover:text-slate-800'
              }`}
            >
              {t(LABEL_KEY[lang])}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom'

import { useLanguages } from '../hooks/useLanguages'
import { clearSelectedLangCode, getSelectedLangCode } from '../lib/selectedLanguage'

export function useLanguageId(): number {
  const { langCode } = useParams()
  // Dil listesi zaten cache'te; koddan id'yi cozeriz (ekstra istek yok).
  const { data: languages } = useLanguages()
  return languages?.find((l) => l.code === langCode)?.id ?? 0
}

export function WorkspaceLayout() {
  const { t } = useTranslation()
  const { langCode } = useParams()
  const { data: languages, isLoading } = useLanguages()
  const language = languages?.find((l) => l.code === langCode)

  if (isLoading) return <p className="text-slate-400">{t('common.loading')}</p>
  if (!language) {
    if (getSelectedLangCode() === langCode) clearSelectedLangCode()
    return <Navigate to="/languages" replace />
  }

  const tabs = [
    { to: 'topics', label: t('nav.topics') },
    { to: 'words', label: t('nav.words') },
    { to: 'labels', label: t('nav.labels') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-base font-semibold uppercase text-violet-600">
            {language.code.slice(0, 2)}
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{language.name}</h1>
            <p className="text-sm text-slate-500">{language.native_name}</p>
          </div>
        </div>
        <Link
          to="/languages"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-500 shadow-sm transition hover:border-violet-200 hover:text-violet-600"
        >
          <span className="text-base leading-none">⇄</span>
          {t('workspace.switchLanguage')}
        </Link>
      </div>

      <nav className="flex gap-1 rounded-xl border border-slate-200/70 bg-white/60 p-1 backdrop-blur-sm">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}

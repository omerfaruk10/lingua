import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom'

import { useLanguage } from '../hooks/useLanguages'
import { clearSelectedLanguageId, getSelectedLanguageId } from '../lib/selectedLanguage'

export function useLanguageId(): number {
  const { languageId } = useParams()
  return Number(languageId)
}

export function WorkspaceLayout() {
  const { t } = useTranslation()
  const languageId = useLanguageId()
  const { data: language, isLoading, isError } = useLanguage(languageId)

  if (isLoading) return <p className="text-slate-400">{t('common.loading')}</p>
  if (isError || !language) {
    // Secili dil silinmis/gecersiz: hatirlanan id'yi temizle, secim sayfasina don.
    if (getSelectedLanguageId() === languageId) clearSelectedLanguageId()
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
          className="text-sm font-medium text-slate-400 transition hover:text-violet-600"
        >
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

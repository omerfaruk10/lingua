import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'

import { useLanguage } from '../hooks/useLanguages'

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
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
        {t('common.error')} ·{' '}
        <Link to="/languages" className="underline">
          {t('nav.languages')}
        </Link>
      </div>
    )
  }

  const tabs = [
    { to: 'topics', label: t('nav.topics') },
    { to: 'words', label: t('nav.words') },
    { to: 'labels', label: t('nav.labels') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{language.name}</h1>
          <p className="text-sm text-slate-500">
            {language.native_name} · <span className="uppercase">{language.code}</span>
          </p>
        </div>
        <Link to="/languages" className="text-sm text-violet-600 hover:underline">
          {t('workspace.switchLanguage')}
        </Link>
      </div>

      <nav className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
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

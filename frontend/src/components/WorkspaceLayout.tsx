import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router-dom'

import { useLanguages } from '../hooks/useLanguages'
import { useDueWords } from '../hooks/useWords'
import { findCourseBySlug } from '../lib/courseSlug'
import { langName } from '../lib/langName'
import { clearSelectedCourseSlug, getSelectedCourseSlug } from '../lib/selectedLanguage'
import type { Language } from '../types'

export function useCurrentCourse(): Language | undefined {
  const { courseSlug: slug } = useParams()
  // Kurs listesi zaten cache'te; slug'dan kursu cozeriz (ekstra istek yok).
  const { data: languages } = useLanguages()
  return findCourseBySlug(languages ?? [], slug)
}

export function useLanguageId(): number {
  return useCurrentCourse()?.id ?? 0
}

export function WorkspaceLayout() {
  const { t } = useTranslation()
  const { courseSlug: slug } = useParams()
  const { data: languages, isLoading } = useLanguages()
  const language = findCourseBySlug(languages ?? [], slug)
  const dueCount = useDueWords(language?.id ?? 0).data?.length ?? 0

  if (isLoading) return <p className="text-slate-400">{t('common.loading')}</p>
  if (!language) {
    if (getSelectedCourseSlug() === slug) clearSelectedCourseSlug()
    return <Navigate to="/languages" replace />
  }

  const tabs = [
    { to: 'topics', label: t('nav.topics') },
    { to: 'words', label: t('nav.words') },
    { to: 'review', label: t('nav.review'), badge: dueCount },
    { to: 'labels', label: t('nav.labels') },
    { to: 'stats', label: t('nav.stats') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 text-base font-semibold uppercase text-violet-600">
            {language.code.slice(0, 2)}
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {langName(t, language.code, language.name)}
            </h1>
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
              `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-center text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {tab.label}
            {'badge' in tab && tab.badge ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-600 px-1.5 text-xs font-semibold text-white tabular-nums">
                {tab.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { Link, Navigate, Route, Routes } from 'react-router-dom'

import { BackendStatus } from './components/BackendStatus'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import { getSelectedLanguageId } from './lib/selectedLanguage'
import { LabelsPage } from './pages/LabelsPage'
import { LanguagesPage } from './pages/LanguagesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TopicsPage } from './pages/TopicsPage'
import { WordsPage } from './pages/WordsPage'

function RootRedirect() {
  const id = getSelectedLanguageId()
  return <Navigate to={id ? `/lang/${id}/topics` : '/languages'} replace />
}

function App() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/languages" className="group flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-bold text-white shadow-sm shadow-violet-500/30 transition group-hover:scale-105">
              L
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-800">Lingua</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <BackendStatus />
            <Link to="/settings" className="btn-ghost px-3 py-1.5">
              {t('nav.settings')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/languages" element={<LanguagesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/lang/:languageId" element={<WorkspaceLayout />}>
            <Route index element={<Navigate to="topics" replace />} />
            <Route path="topics" element={<TopicsPage />} />
            <Route path="words" element={<WordsPage />} />
            <Route path="labels" element={<LabelsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

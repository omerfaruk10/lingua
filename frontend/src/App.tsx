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
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4">
      <header className="flex items-center justify-between gap-4 py-5">
        <Link to="/languages" className="text-2xl font-bold text-violet-600">
          {t('app.title')}
        </Link>
        <div className="flex items-center gap-3">
          <BackendStatus />
          <Link
            to="/settings"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t('nav.settings')}
          </Link>
        </div>
      </header>

      <main className="flex-1 py-4">
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

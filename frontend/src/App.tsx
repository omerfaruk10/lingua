import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Route, Routes } from 'react-router-dom'

import { BackendStatus } from './components/BackendStatus'
import { WorkspaceLayout } from './components/WorkspaceLayout'
import { SUPPORTED_LANGS, setUiLang } from './i18n'
import { getSelectedLanguageId } from './lib/selectedLanguage'
import { LabelsPage } from './pages/LabelsPage'
import { LanguagesPage } from './pages/LanguagesPage'
import { TopicsPage } from './pages/TopicsPage'
import { WordsPage } from './pages/WordsPage'

const LANG_FLAG: Record<string, string> = {
  en: '🇬🇧', tr: '🇹🇷', it: '🇮🇹', es: '🇪🇸', de: '🇩🇪', fr: '🇫🇷',
}
const LANG_NATIVE: Record<string, string> = {
  en: 'English', tr: 'Türkçe', it: 'Italiano', es: 'Español', de: 'Deutsch', fr: 'Français',
}

function UiLangDropdown() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = i18n.language as string

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost flex items-center gap-1.5 px-2.5 py-1.5 text-sm"
      >
        <span>{LANG_FLAG[current] ?? '🌐'}</span>
        <span className="font-medium uppercase">{current}</span>
        <span className="text-slate-400 text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {SUPPORTED_LANGS.map((lang) => (
            <button
              key={lang}
              onClick={() => { setUiLang(lang); setOpen(false) }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-slate-50 ${
                lang === current ? 'font-semibold text-violet-600' : 'text-slate-700'
              }`}
            >
              <span>{LANG_FLAG[lang]}</span>
              <span>{LANG_NATIVE[lang]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RootRedirect() {
  const id = getSelectedLanguageId()
  return <Navigate to={id ? `/lang/${id}/topics` : '/languages'} replace />
}

function App() {
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
          <div className="flex items-center gap-2">
            <BackendStatus />
            <UiLangDropdown />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/languages" element={<LanguagesPage />} />
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

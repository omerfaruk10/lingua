import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { ButtonProgress } from './LoadingBar'

export function WordFormDrawer({
  title,
  formId,
  submitting,
  submitLabel,
  submittingLabel,
  children,
  onClose,
}: {
  title: string
  formId: string
  submitting: boolean
  submitLabel: string
  submittingLabel: string
  children: ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [showSubmitting, setShowSubmitting] = useState(false)

  useEffect(() => {
    if (!submitting) {
      setShowSubmitting(false)
      return
    }
    const timer = window.setTimeout(() => setShowSubmitting(true), 150)
    return () => window.clearTimeout(timer)
  }, [submitting])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, submitting])

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="animate-overlay absolute inset-0 h-full w-full cursor-default bg-slate-900/35 backdrop-blur-[2px]"
        onClick={() => { if (!submitting) onClose() }}
        aria-label={t('common.close')}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-panel absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl shadow-slate-900/15 sm:inset-y-3 sm:right-3 sm:w-[calc(100%-1.5rem)] sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/80"
      >
        <header className="flex shrink-0 items-center justify-between px-4 pb-1 pt-4 sm:px-6">
          <h2 className="truncate text-sm font-medium text-slate-700">{title}</h2>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-slate-50 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 active:scale-[0.96] disabled:cursor-default disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
            title={t('common.close')}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="drawer-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-8 sm:pt-4">
          <div className="mx-auto max-w-xl py-2 text-left">{children}</div>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-2 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:px-6 sm:pb-4">
          <button
            type="submit"
            form={formId}
            disabled={submitting}
            className="relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
          >
            <span>{showSubmitting ? submittingLabel : submitLabel}</span>
            <ButtonProgress active={submitting} label={submittingLabel} />
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="m6 6 8 8m0-8-8 8" strokeLinecap="round" />
    </svg>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { Label, LanguageBrief, Word } from '../types'
import { LabelBadge } from './LabelBadge'
import { labelColor } from './labelColors'
import { LoadingBar } from './LoadingBar'
import { orderMeanings, WordCardContent } from './WordCardContent'

export function WordPreviewDrawer({
  word,
  loading,
  mode,
  navigating,
  editContent,
  editFormId,
  editSubmitting,
  langCode,
  meaningLangs,
  targetLang,
  allLabels,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onAddLabel,
  onRemoveLabel,
  onEdit,
  onCancelEdit,
  onDelete,
  onClose,
}: {
  word: Word | undefined
  loading: boolean
  mode: 'preview' | 'edit'
  navigating: boolean
  editContent?: ReactNode
  editFormId?: string
  editSubmitting?: boolean
  langCode?: string
  meaningLangs: LanguageBrief[]
  targetLang?: LanguageBrief
  allLabels: Label[]
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void | Promise<void>
  onNext: () => void | Promise<void>
  onAddLabel: (labelId: number) => void
  onRemoveLabel: (labelId: number) => void
  onEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [labelPickerOpen, setLabelPickerOpen] = useState(false)
  const [showEditSubmitting, setShowEditSubmitting] = useState(false)
  const labelPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editSubmitting) {
      setShowEditSubmitting(false)
      return
    }
    const timer = window.setTimeout(() => setShowEditSubmitting(true), 150)
    return () => window.clearTimeout(timer)
  }, [editSubmitting])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (mode === 'preview' && event.key === 'ArrowLeft' && hasPrevious && !navigating) onPrevious()
      if (mode === 'preview' && event.key === 'ArrowRight' && hasNext && !navigating) onNext()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [hasNext, hasPrevious, mode, navigating, onClose, onNext, onPrevious])

  useEffect(() => {
    if (!labelPickerOpen) return
    function close(event: MouseEvent) {
      if (!labelPickerRef.current?.contains(event.target as Node)) setLabelPickerOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [labelPickerOpen])

  const availableLabels = word
    ? allLabels.filter((label) => !word.labels.some((current) => current.id === label.id))
    : []

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="animate-overlay absolute inset-0 h-full w-full cursor-default bg-slate-900/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={t('common.close')}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('words.preview')}
        className="animate-panel absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl shadow-slate-900/15 sm:inset-y-3 sm:right-3 sm:w-[calc(100%-1.5rem)] sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/80"
      >
        <header className={`flex shrink-0 items-center px-4 pb-1 pt-4 sm:px-6 ${mode === 'edit' ? 'justify-between' : 'justify-end'}`}>
          {mode === 'edit' && (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"
                aria-label={t('words.preview')}
                title={t('words.preview')}
              >
                <ArrowLeftIcon />
              </button>
              <span className="truncate text-sm font-medium text-slate-700">{t('words.editTitle')}</span>
            </div>
          )}
          <div className={`flex shrink-0 items-center gap-1 ${mode === 'preview' ? 'rounded-2xl bg-slate-50/90 p-1 ring-1 ring-slate-100' : ''}`}>
            {mode === 'preview' && (
              <>
                <button
                  type="button"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-slate-400 transition hover:bg-white hover:text-violet-600 hover:shadow-sm disabled:cursor-default disabled:opacity-35"
                  onClick={onPrevious}
                  disabled={!hasPrevious || navigating}
                  title={t('words.previousWord')}
                  aria-label={t('words.previousWord')}
                >
                  <ArrowLeftIcon />
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-slate-400 transition hover:bg-white hover:text-violet-600 hover:shadow-sm disabled:cursor-default disabled:opacity-35"
                  onClick={onNext}
                  disabled={!hasNext || navigating}
                  title={t('words.nextWord')}
                  aria-label={t('words.nextWord')}
                >
                  <ArrowRightIcon />
                </button>
                <span className="mx-0.5 h-4 w-px bg-slate-200" />
              </>
            )}
            <button
              type="button"
              className={`grid cursor-pointer place-items-center rounded-xl bg-slate-50 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 active:scale-[0.96] ${mode === 'preview' ? 'h-8 w-8' : 'h-9 w-9'}`}
              onClick={onClose}
              title={t('common.close')}
              aria-label={t('common.close')}
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <LoadingBar active={loading} label={t('common.loading')} />

        <div className="drawer-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-8 sm:pt-4">
          {loading || !word ? (
            <div className="min-h-48" />
          ) : mode === 'edit' ? (
            <div className="mx-auto max-w-xl py-2 text-left">{editContent}</div>
          ) : (
            <div className="mx-auto max-w-xl text-center">
              <WordCardContent
                word={word}
                orderedMeanings={orderMeanings(word, meaningLangs.map((language) => language.id))}
                revealed
                langCode={langCode}
                meaningLangs={meaningLangs}
                targetLang={targetLang}
              />

              <section className="mx-auto mt-5 max-w-md border-t border-slate-100 pt-4 text-left">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('nav.labels')}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {word.labels.map((label) => (
                    <LabelBadge key={label.id} label={label} onRemove={() => onRemoveLabel(label.id)} />
                  ))}
                  {word.labels.length === 0 && (
                    <span className="text-sm text-slate-400">{t('labels.noneAssigned')}</span>
                  )}
                  {availableLabels.length > 0 && (
                    <div ref={labelPickerRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setLabelPickerOpen((value) => !value)}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-dashed border-slate-300 text-sm font-semibold text-slate-500 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
                        aria-label={t('labels.addToWord')}
                        title={t('labels.addToWord')}
                      >
                        +
                      </button>
                      {labelPickerOpen && (
                        <div className="absolute bottom-full left-0 z-20 mb-2 max-h-52 min-w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                          {availableLabels.map((label) => (
                            <button
                              key={label.id}
                              type="button"
                              onClick={() => { onAddLabel(label.id); setLabelPickerOpen(false) }}
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
                            >
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: labelColor(label.color) }} />
                              {label.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        {word && mode === 'preview' && (
          <footer className="grid shrink-0 grid-cols-2 gap-2 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:px-6 sm:pb-4">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 active:scale-[0.98]"
            >
              {t('common.edit')}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700 active:scale-[0.98]"
            >
              {t('common.remove')}
            </button>
          </footer>
        )}
        {word && mode === 'edit' && (
          <footer className="grid shrink-0 grid-cols-2 gap-2 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:px-6 sm:pb-4">
            <button
              type="submit"
              form={editFormId}
              disabled={editSubmitting}
              className="relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 hover:text-violet-800 active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
            >
              <span>{showEditSubmitting ? t('common.saving') : t('common.save')}</span>
              {showEditSubmitting && (
                <span className="button-loading-track" aria-hidden="true">
                  <span className="button-loading-line" />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={editSubmitting}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98] disabled:cursor-default disabled:opacity-60"
            >
              {t('common.cancel')}
            </button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  )
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="m12.5 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="m7.5 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="m6 6 8 8m0-8-8 8" strokeLinecap="round" />
    </svg>
  )
}

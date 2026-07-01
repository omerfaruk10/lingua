import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { WordImportRow } from '../api/words'
import { useImportWords, useWords } from '../hooks/useWords'
import { translateApiError } from '../lib/apiErrors'
import { LABEL_PALETTE } from './labelColors'
import { Modal } from './Modal'
import { parseWordsCsv, type ParsedWordRow } from '../lib/wordCsvImport'
import { buildWordCsvSchema } from '../lib/wordCsvSchema'
import type { LanguageBrief } from '../types'

type ConflictAction = 'skip' | 'replace'

export function ImportWordsModal({
  courseId,
  nativeLang,
  helperLangs,
  targetLang,
  onClose,
}: {
  courseId: number
  nativeLang: LanguageBrief | null
  helperLangs: LanguageBrief[]
  targetLang: LanguageBrief | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const importWords = useImportWords(courseId)
  // Filtrelerden bagimsiz, tam liste -- cakisma tespiti icin.
  const { data: allWords } = useWords(courseId)
  const existingWords = useMemo(() => allWords ?? [], [allWords])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [labelName, setLabelName] = useState('')
  const [parsed, setParsed] = useState<{ rows: ParsedWordRow[]; errors: { row: number; message: string }[] } | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [conflictActions, setConflictActions] = useState<Record<number, ConflictAction>>({})
  const [result, setResult] = useState<{ created: number; replaced: number; errors: { row: number; message: string }[] } | null>(null)

  const schema = useMemo(
    () => buildWordCsvSchema(t, nativeLang, helperLangs, targetLang),
    [t, nativeLang, helperLangs, targetLang],
  )
  const existingByTerm = useMemo(
    () => new Map(existingWords.map((w) => [w.term.trim().toLowerCase(), w])),
    [existingWords],
  )

  function handleFile(file: File) {
    setFatalError(null)
    setResult(null)
    setConflictActions({})
    const base = file.name.replace(/\.(csv|txt)$/i, '')
    setLabelName(base)
    file.text().then((text) => {
      const parsedResult = parseWordsCsv(text, schema, t)
      if (parsedResult.fatalError) {
        setFatalError(parsedResult.fatalError)
        setParsed(null)
        return
      }
      setParsed({ rows: parsedResult.rows, errors: parsedResult.errors })
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const conflicts = useMemo(
    () =>
      (parsed?.rows ?? []).filter((r) => existingByTerm.has(r.data.term.trim().toLowerCase())),
    [parsed, existingByTerm],
  )
  const newRows = useMemo(
    () =>
      (parsed?.rows ?? []).filter((r) => !existingByTerm.has(r.data.term.trim().toLowerCase())),
    [parsed, existingByTerm],
  )

  function actionFor(row: number): ConflictAction {
    return conflictActions[row] ?? 'skip'
  }
  function setAllConflicts(action: ConflictAction) {
    const next: Record<number, ConflictAction> = {}
    for (const c of conflicts) next[c.row] = action
    setConflictActions(next)
  }

  function confirm() {
    const rows: WordImportRow[] = []
    for (const r of newRows) {
      rows.push({ ...r.data, action: 'create' })
    }
    for (const c of conflicts) {
      if (actionFor(c.row) !== 'replace') continue
      const existing = existingByTerm.get(c.data.term.trim().toLowerCase())!
      rows.push({ ...c.data, action: 'replace', replace_word_id: existing.id })
    }
    const trimmedLabel = labelName.trim()
    importWords.mutate(
      {
        rows,
        label_name: trimmedLabel || undefined,
        label_color: trimmedLabel ? LABEL_PALETTE[0] : undefined,
      },
      {
        onSuccess: (res) => setResult({ created: res.created, replaced: res.replaced, errors: res.errors }),
      },
    )
  }

  const replaceCount = conflicts.filter((c) => actionFor(c.row) === 'replace').length
  const skipCount = conflicts.length - replaceCount

  return (
    <Modal title={t('words.importTitle')} onClose={onClose} maxWidth="max-w-2xl">
      {result ? (
        <div className="space-y-4">
          <p className="text-slate-700">
            {t('words.importSuccess', { created: result.created, replaced: result.replaced })}
          </p>
          {result.errors.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              {result.errors.map((e, i) => (
                <li key={i}>{t('words.importRowError', { row: e.row, message: translateApiError(t, e.message) })}</li>
              ))}
            </ul>
          )}
          <button onClick={onClose} className="btn-primary w-full">
            {t('common.close')}
          </button>
        </div>
      ) : !parsed ? (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <span className="field-label mb-0">{t('words.importChooseFile')}</span>
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-500 cursor-default"
              title={t('words.importHint')}
            >
              i
            </span>
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? 'border-violet-400 bg-violet-50'
                : 'border-slate-200 bg-slate-50/50 hover:border-violet-300 hover:bg-violet-50/40'
            }`}
          >
            <span className="text-2xl">⤓</span>
            <p className="text-sm text-slate-600">{t('words.importDropHint')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
              className="hidden"
            />
          </div>
          {fatalError && <p className="text-sm text-red-500">{fatalError}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="field-label">{t('words.importLabelName')}</span>
            <input
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              className="input"
            />
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p>{t('words.importSummaryNew', { n: newRows.length })}</p>
            {conflicts.length > 0 && (
              <p>{t('words.importSummaryConflicts', { n: conflicts.length })}</p>
            )}
            {parsed.errors.length > 0 && (
              <p>{t('words.importSummarySkippedRows', { n: parsed.errors.length })}</p>
            )}
          </div>

          {parsed.errors.length > 0 && (
            <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              {parsed.errors.map((e, i) => (
                <li key={i}>{t('words.importRowError', { row: e.row, message: e.message })}</li>
              ))}
            </ul>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="field-label mb-0">{t('words.importConflicts')}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAllConflicts('skip')} className="btn-ghost px-2 py-1 text-xs">
                    {t('words.importSkipAll')}
                  </button>
                  <button type="button" onClick={() => setAllConflicts('replace')} className="btn-ghost px-2 py-1 text-xs">
                    {t('words.importReplaceAll')}
                  </button>
                </div>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200">
                {conflicts.map((c) => (
                  <li key={c.row} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                    <span className="truncate text-slate-800">{c.data.term}</span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setConflictActions((a) => ({ ...a, [c.row]: 'skip' }))}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                          actionFor(c.row) === 'skip'
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {t('words.importSkip')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConflictActions((a) => ({ ...a, [c.row]: 'replace' }))}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                          actionFor(c.row) === 'replace'
                            ? 'bg-violet-600 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {t('words.importReplace')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {importWords.error != null && (
            <p className="text-sm text-red-500">{translateApiError(t, importWords.error)}</p>
          )}

          <button
            onClick={confirm}
            disabled={importWords.isPending || (newRows.length === 0 && replaceCount === 0)}
            className="btn-primary w-full"
          >
            {t('words.importConfirm', { n: newRows.length + replaceCount })}
          </button>
          {skipCount > 0 && (
            <p className="text-center text-xs text-slate-400">
              {t('words.importSummarySkippedConflicts', { n: skipCount })}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

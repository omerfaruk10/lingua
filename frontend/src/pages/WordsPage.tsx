import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { WordInput } from '../api/words'
import { LabelBadge } from '../components/LabelBadge'
import { labelColor } from '../components/labelColors'
import { useConfirm } from '../components/ConfirmProvider'
import { ImportWordsModal } from '../components/ImportWordsModal'
import { Modal } from '../components/Modal'
import { WordForm } from '../components/WordForm'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useLabels } from '../hooks/useLabels'
import { downloadCsv, toCsv } from '../lib/csv'
import { buildWordCsvSchema } from '../lib/wordCsvSchema'
import {
  useAddWordLabel,
  useCreateWord,
  useDeleteWord,
  useRemoveWordLabel,
  useSetWordStatus,
  useUpdateWord,
  useWords,
} from '../hooks/useWords'
import type { Label, LanguageBrief, LearningStatus, Word } from '../types'

const LEARNING_STATUSES: LearningStatus[] = ['new', 'learning', 'learned']

const LEARNING_STYLE: Record<LearningStatus, string> = {
  new: 'bg-slate-100 text-slate-500',
  learning: 'bg-amber-100 text-amber-700',
  learned: 'bg-emerald-100 text-emerald-700',
}

export function WordsPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const languageId = useLanguageId()
  const course = useCurrentCourse()
  const nativeLang = course?.native_language ?? null
  const helperLangs = course?.helper_languages ?? []
  const targetLang = course?.target_language ?? null
  // Anlamlari etiketlemek/siralamak icin: ana dil once, sonra yardimcilar.
  const meaningLangs: LanguageBrief[] = nativeLang ? [nativeLang, ...helperLangs] : []
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<LearningStatus | null>(null)

  const query = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(labelFilter != null ? { label_id: labelFilter } : {}),
    ...(statusFilter != null ? { status: statusFilter } : {}),
  }
  const { data: words, isLoading } = useWords(
    languageId,
    Object.keys(query).length ? query : undefined,
  )
  const { data: labels } = useLabels(languageId)

  const createWord = useCreateWord(languageId)
  const updateWord = useUpdateWord(languageId)
  const deleteWord = useDeleteWord(languageId)
  const addLabel = useAddWordLabel(languageId)
  const removeLabel = useRemoveWordLabel(languageId)
  const setStatus = useSetWordStatus(languageId)

  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<Word | null>(null)

  const list = words ?? []
  const allLabels = labels ?? []

  function create(data: WordInput) {
    createWord.mutate(data, { onSuccess: () => setAddOpen(false) })
  }
  function update(data: WordInput) {
    if (!editingWord) return
    updateWord.mutate({ wordId: editingWord.id, data }, { onSuccess: () => setEditingWord(null) })
  }
  async function remove(wordId: number) {
    const ok = await confirm({
      message: t('words.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (ok) deleteWord.mutate(wordId)
  }

  async function exportCsv() {
    if (list.length === 0) return
    const ok = await confirm({
      message: t('words.exportConfirm', { n: list.length }),
      confirmLabel: t('words.export'),
    })
    if (!ok) return
    // Basliklar import ile ayni kaynaktan (wordCsvSchema) gelir, ikisi senkron kalir.
    // Sabit 8+H sutun: etiket/durum yazilmaz ki export tekrar import edilebilsin.
    const schema = buildWordCsvSchema(t, nativeLang, helperLangs, targetLang)
    const rows = list.map((w) => {
      const meaningCells = schema.meaningLangs.map(
        (lang) => w.meanings.find((m) => m.language_id === lang.id)?.value ?? '',
      )
      return [
        w.term, w.part_of_speech, w.phonetic, w.phonetic_native,
        ...meaningCells, w.definition_target,
        w.example_sentence, w.example_translation,
      ].map((v) => v ?? '')
    })
    const date = new Date().toISOString().slice(0, 10)
    const code = course?.code ?? 'words'
    downloadCsv(`lingua-${code}-words-${date}.csv`, toCsv([schema.headers, ...rows]))
  }

  return (
    <div className="space-y-5">
      {/* Arama + ekle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            ⌕
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('words.searchPlaceholder')}
            className="input pl-9"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={list.length === 0}
          className="btn-ghost shrink-0"
          title={t('words.export')}
        >
          ⤒ {t('words.export')}
        </button>
        <button onClick={() => setImportOpen(true)} className="btn-ghost shrink-0" title={t('words.import')}>
          ⤓ {t('words.import')}
        </button>
        <button onClick={() => setAddOpen(true)} className="btn-primary shrink-0">
          + {t('words.add')}
        </button>
      </div>

      {/* Ogrenme durumuna gore filtre */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={statusFilter == null} onClick={() => setStatusFilter(null)}>
          {t('learning.all')}
        </FilterChip>
        {LEARNING_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter((cur) => (cur === s ? null : s))}
          >
            {t(`learning.${s}`)}
          </FilterChip>
        ))}
      </div>

      {/* Etikete gore filtre */}
      {allLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={labelFilter == null} onClick={() => setLabelFilter(null)}>
            {t('labels.all')}
          </FilterChip>
          {allLabels.map((label) => (
            <FilterChip
              key={label.id}
              active={labelFilter === label.id}
              color={labelColor(label.color)}
              onClick={() => setLabelFilter((cur) => (cur === label.id ? null : label.id))}
            >
              {label.name}
            </FilterChip>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">{search.trim() || labelFilter != null ? '🔍' : '📖'}</span>
          <p className="text-slate-400">
            {search.trim() || labelFilter != null ? t('words.noResults') : t('words.empty')}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((word, index) => (
            <WordCard
              key={word.id}
              word={word}
              index={index + 1}
              meaningLangs={meaningLangs}
              allLabels={allLabels}
              onAddLabel={(labelId) => addLabel.mutate({ wordId: word.id, labelId })}
              onRemoveLabel={(labelId) => removeLabel.mutate({ wordId: word.id, labelId })}
              onSetStatus={(status) => setStatus.mutate({ wordId: word.id, status })}
              onEdit={() => setEditingWord(word)}
              onDelete={() => remove(word.id)}
            />
          ))}
        </ul>
      )}

      {addOpen && nativeLang && targetLang && (
        <Modal title={t('words.addTitle')} onClose={() => setAddOpen(false)} maxWidth="max-w-2xl">
          <WordForm
            bare
            nativeLang={nativeLang}
            helperLangs={helperLangs}
            targetLang={targetLang}
            submitLabel={t('words.add')}
            submitting={createWord.isPending}
            onSubmit={create}
            onCancel={() => setAddOpen(false)}
          />
        </Modal>
      )}

      {editingWord && nativeLang && targetLang && (
        <Modal title={t('words.editTitle')} onClose={() => setEditingWord(null)} maxWidth="max-w-2xl">
          <WordForm
            bare
            initial={editingWord}
            nativeLang={nativeLang}
            helperLangs={helperLangs}
            targetLang={targetLang}
            submitLabel={t('common.save')}
            submitting={updateWord.isPending}
            onSubmit={update}
            onCancel={() => setEditingWord(null)}
          />
        </Modal>
      )}

      {importOpen && (
        <ImportWordsModal
          courseId={languageId}
          nativeLang={nativeLang}
          helperLangs={helperLangs}
          targetLang={targetLang}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  )
}

function LabelPicker({ available, onAdd, open, onToggle, t }: {
  available: Label[]
  onAdd: (id: number) => void
  open: boolean
  onToggle: () => void
  t: (k: string) => string
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return
      onToggle()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    onToggle()
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-400 hover:border-violet-400 hover:text-violet-600"
      >
        + {t('labels.addToWord')}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 max-w-xs rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          {available.length === 0 ? (
            <p className="px-1 py-0.5 text-xs text-slate-400">{t('labels.noneToAdd')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((label) => (
                <button
                  key={label.id}
                  onClick={() => onAdd(label.id)}
                  style={{ backgroundColor: labelColor(label.color) }}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white hover:opacity-80"
                >
                  {label.name}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={active && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
          : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  )
}

function WordStatusDropdown({
  word,
  onSetStatus,
}: {
  word: Word
  onSetStatus: (s: LearningStatus) => void
}) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tekrar programi 'learned' durumunda yasar; oradan cikmak programi siler.
  function losesProgress(target: LearningStatus): boolean {
    return word.learning_status === 'learned' && target !== 'learned'
  }

  async function pick(s: LearningStatus) {
    setOpen(false)
    if (s === word.learning_status) return
    const reset = losesProgress(s)
    const status = t(`learning.${s}`)
    const ok = await confirm({
      message: t(reset ? 'learning.resetConfirm' : 'learning.changeConfirm', { status }),
      confirmLabel: t('common.yes'),
      danger: reset,
    })
    if (!ok) return
    onSetStatus(s)
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.right - 150 })
    }
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition hover:opacity-80 ${LEARNING_STYLE[word.learning_status]}`}
      >
        {t(`learning.${word.learning_status}`)}
        <span className="opacity-60">▾</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 min-w-[150px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {LEARNING_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => pick(s)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition hover:bg-slate-50 ${word.learning_status === s ? 'text-slate-900' : 'text-slate-600'}`}
            >
              {word.learning_status === s ? <span className="text-[10px]">✓</span> : <span className="w-3" />}
              <span>{t(`learning.${s}`)}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function WordCard({
  word,
  index,
  meaningLangs,
  allLabels,
  onAddLabel,
  onRemoveLabel,
  onSetStatus,
  onEdit,
  onDelete,
}: {
  word: Word
  index: number
  meaningLangs: LanguageBrief[]
  allLabels: Label[]
  onAddLabel: (labelId: number) => void
  onRemoveLabel: (labelId: number) => void
  onSetStatus: (s: LearningStatus) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const available = allLabels.filter((l) => !word.labels.some((wl) => wl.id === l.id))
  // Kelimenin etiketlerini, Etiketler tab'indaki global sirayla goster (ekleme sirasiyla degil)
  const order = new Map(allLabels.map((l, i) => [l.id, i]))
  const sortedLabels = [...word.labels].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  )
  // Anlamlari kurs dil sirasiyla goster (ana dil once); deger girilmemis dilleri atla.
  const meaningById = new Map(word.meanings.map((m) => [m.language_id, m.value]))
  const orderedMeanings = meaningLangs
    .map((lang) => meaningById.get(lang.id))
    .filter((v): v is string => !!v && v.trim().length > 0)

  return (
    <li className="card group p-4 transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400 tabular-nums">#{index}</span>
            <span className="text-lg font-semibold text-slate-900">{word.term}</span>
            {word.part_of_speech && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {t(`words.partsOfSpeech.${word.part_of_speech}`, { defaultValue: word.part_of_speech })}
              </span>
            )}
            {(word.phonetic || word.phonetic_native) && (
              <span className="text-sm text-slate-400">
                {[word.phonetic, word.phonetic_native].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {orderedMeanings.length > 0 && (
            <div className="mt-1 text-slate-700">
              {orderedMeanings[0]}
              {orderedMeanings.length > 1 && (
                <span className="text-slate-400"> · {orderedMeanings.slice(1).join(' · ')}</span>
              )}
            </div>
          )}

          {word.definition_target && (
            <div className="mt-1 text-sm italic text-slate-500">{word.definition_target}</div>
          )}

          {word.example_sentence && (
            <div className="mt-2 border-l-2 border-slate-200 pl-3 text-sm">
              <div className="text-slate-700">{word.example_sentence}</div>
              {word.example_translation && (
                <div className="text-slate-400">{word.example_translation}</div>
              )}
            </div>
          )}

          {/* Etiketler */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {sortedLabels.map((label) => (
              <LabelBadge key={label.id} label={label} onRemove={() => onRemoveLabel(label.id)} />
            ))}
            <LabelPicker
              available={available}
              onAdd={(id) => { onAddLabel(id); setPicking(false) }}
              open={picking}
              onToggle={() => setPicking((p) => !p)}
              t={t}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <WordStatusDropdown word={word} onSetStatus={onSetStatus} />
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button onClick={onEdit} className="btn-icon" title={t('common.edit')}>
              ✎
            </button>
            <button onClick={onDelete} className="btn-icon-danger" title={t('common.delete')}>
              ✕
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { WordInput } from '../api/words'
import { LabelBadge } from '../components/LabelBadge'
import { labelColor } from '../components/labelColors'
import { useConfirm } from '../components/ConfirmProvider'
import { ImportWordsModal } from '../components/ImportWordsModal'
import { Modal } from '../components/Modal'
import { SpeakButton } from '../components/SpeakButton'
import { WordForm } from '../components/WordForm'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useLabels } from '../hooks/useLabels'
import { downloadCsv, toCsv } from '../lib/csv'
import { langName } from '../lib/langName'
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
import type { Label, LanguageBrief, LearningStatus, Word, WordLevel } from '../types'

const LEARNING_STATUSES: LearningStatus[] = ['new', 'learning', 'learned']
const WORD_LEVELS: WordLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'numeral',
] as const
type SortKey =
  | 'created_desc'
  | 'created_asc'
  | 'term_asc'
  | 'term_desc'
  | 'level_asc'
  | 'level_desc'

const LEARNING_STYLE: Record<LearningStatus, string> = {
  new: 'bg-slate-100 text-slate-500',
  learning: 'bg-amber-100 text-amber-700',
  learned: 'bg-emerald-100 text-emerald-700',
}

const LEVEL_ORDER = new Map(WORD_LEVELS.map((level, i) => [level, i]))

function sortWords(words: Word[], sortKey: SortKey): Word[] {
  const byDate = (a: Word, b: Word) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  const byLevel = (a: Word, b: Word) =>
    (a.level ? LEVEL_ORDER.get(a.level) ?? 999 : 999) - (b.level ? LEVEL_ORDER.get(b.level) ?? 999 : 999)

  return [...words].sort((a, b) => {
    switch (sortKey) {
      case 'created_desc':
        return byDate(b, a) || a.id - b.id
      case 'term_asc':
        return a.term.localeCompare(b.term) || a.id - b.id
      case 'term_desc':
        return b.term.localeCompare(a.term) || a.id - b.id
      case 'level_asc':
        return byLevel(a, b) || a.term.localeCompare(b.term)
      case 'level_desc':
        return byLevel(b, a) || a.term.localeCompare(b.term)
      case 'created_asc':
      default:
        return byDate(a, b) || a.id - b.id
    }
  })
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
  const [levelFilter, setLevelFilter] = useState<WordLevel | null>(null)
  const [posFilter, setPosFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('created_asc')

  const query = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(labelFilter != null ? { label_id: labelFilter } : {}),
    ...(statusFilter != null ? { status: statusFilter } : {}),
    ...(levelFilter != null ? { level: levelFilter } : {}),
    ...(posFilter != null ? { part_of_speech: posFilter } : {}),
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

  const allLabels = labels ?? []
  const list = sortWords(words ?? [], sortKey)
  const activeExtraFilters =
    (levelFilter ? 1 : 0) + (posFilter ? 1 : 0) + (labelFilter != null ? 1 : 0)

  function create(data: WordInput, startLearning: boolean) {
    createWord.mutate(data, {
      onSuccess: (w) => {
        setAddOpen(false)
        // "Ogrenmeye basla" isaretliyse kelime dogrudan ogrenme kuyruguna girer.
        if (startLearning) setStatus.mutate({ wordId: w.id, status: 'learning' })
      },
    })
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
    // Etiket/durum yazilmaz ki export tekrar import edilebilsin ve kart akisi degismesin.
    const schema = buildWordCsvSchema(t, nativeLang, helperLangs, targetLang)
    const rows = list.map((w) => {
      const meaningCells = schema.meaningLangs.map(
        (lang) => w.meanings.find((m) => m.language_id === lang.id)?.value ?? '',
      )
      return [
        w.term, w.part_of_speech, w.level, w.phonetic, w.phonetic_native,
        w.pronunciation_note_native,
        ...meaningCells, w.definition_target,
        w.synonyms, w.antonyms, w.word_family, w.example_sentence, w.example_translation,
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

      {/* Durum hizli filtreleri + ikincil filtre/siralama */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-2">
          <WordFilterMenu
            labels={allLabels}
            levelFilter={levelFilter}
            posFilter={posFilter}
            labelFilter={labelFilter}
            activeCount={activeExtraFilters}
            onLevel={setLevelFilter}
            onPos={setPosFilter}
            onLabel={setLabelFilter}
          />
          <WordSortMenu sortKey={sortKey} onSort={setSortKey} />
        </div>
      </div>

      {activeExtraFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {levelFilter && (
            <ActiveFilterChip onClear={() => setLevelFilter(null)}>
              {t('words.fields.level')}: {levelFilter}
            </ActiveFilterChip>
          )}
          {posFilter && (
            <ActiveFilterChip onClear={() => setPosFilter(null)}>
              {t('words.fields.part_of_speech')}: {t(`words.partsOfSpeech.${posFilter}`, { defaultValue: posFilter })}
            </ActiveFilterChip>
          )}
          {labelFilter != null && (
            <ActiveFilterChip onClear={() => setLabelFilter(null)}>
              {t('labels.filterByLabel')}: {allLabels.find((label) => label.id === labelFilter)?.name ?? labelFilter}
            </ActiveFilterChip>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="card mx-auto w-full max-w-2xl flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">{search.trim() || activeExtraFilters > 0 ? '🔍' : '📖'}</span>
          <p className="text-slate-400">
            {search.trim() || activeExtraFilters > 0 ? t('words.noResults') : t('words.empty')}
          </p>
        </div>
      ) : (
        <ul className="grid items-start gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((word, index) => (
            <WordCard
              key={word.id}
              word={word}
              index={index + 1}
              langCode={targetLang?.code}
              targetLang={targetLang ?? undefined}
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
            courseId={languageId}
            nativeLang={nativeLang}
            helperLangs={helperLangs}
            targetLang={targetLang}
            submitLabel={t('words.add')}
            submitting={createWord.isPending}
            showStartLearning
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
            courseId={languageId}
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

function ActiveFilterChip({
  onClear,
  children,
}: {
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClear}
      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
    >
      {children} <span className="ml-1 text-slate-300">x</span>
    </button>
  )
}

function WordFilterMenu({
  labels,
  levelFilter,
  posFilter,
  labelFilter,
  activeCount,
  onLevel,
  onPos,
  onLabel,
}: {
  labels: Label[]
  levelFilter: WordLevel | null
  posFilter: string | null
  labelFilter: number | null
  activeCount: number
  onLevel: (level: WordLevel | null) => void
  onPos: (pos: string | null) => void
  onLabel: (labelId: number | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-3">
        {t('words.filters')}
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <FilterSection title={t('words.fields.level')}>
            <FilterChip active={levelFilter == null} onClick={() => onLevel(null)}>
              {t('learning.all')}
            </FilterChip>
            {WORD_LEVELS.map((level) => (
              <FilterChip key={level} active={levelFilter === level} onClick={() => onLevel(level)}>
                {level}
              </FilterChip>
            ))}
          </FilterSection>

          <FilterSection title={t('words.fields.part_of_speech')}>
            <FilterChip active={posFilter == null} onClick={() => onPos(null)}>
              {t('learning.all')}
            </FilterChip>
            {PARTS_OF_SPEECH.map((pos) => (
              <FilterChip key={pos} active={posFilter === pos} onClick={() => onPos(pos)}>
                {t(`words.partsOfSpeech.${pos}`)}
              </FilterChip>
            ))}
          </FilterSection>

          <FilterSection title={t('labels.filterByLabel')}>
            <FilterChip active={labelFilter == null} onClick={() => onLabel(null)}>
              {t('labels.all')}
            </FilterChip>
            {labels.length === 0 ? (
              <span className="text-xs text-slate-400">{t('labels.noneToAdd')}</span>
            ) : labels.map((label) => (
              <FilterChip
                key={label.id}
                active={labelFilter === label.id}
                color={labelColor(label.color)}
                onClick={() => onLabel(label.id)}
              >
                {label.name}
              </FilterChip>
            ))}
          </FilterSection>
        </div>
      )}
    </div>
  )
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-xs font-semibold text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function WordSortMenu({
  sortKey,
  onSort,
}: {
  sortKey: SortKey
  onSort: (sort: SortKey) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options: SortKey[] = [
    'created_asc',
    'created_desc',
    'term_asc',
    'term_desc',
    'level_asc',
    'level_desc',
  ]

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-3">
        {t('words.sort')}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => { onSort(option); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-slate-50 ${
                sortKey === option ? 'text-violet-700' : 'text-slate-600'
              }`}
            >
              <span className="w-3 text-[10px]">{sortKey === option ? '✓' : ''}</span>
              {t(`words.sortOptions.${option}`)}
            </button>
          ))}
        </div>
      )}
    </div>
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

function WordCardLegacy({
  word,
  index,
  langCode,
  targetLang: _targetLang,
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
  langCode?: string
  targetLang?: LanguageBrief
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
    <li className="card group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_8px_18px_-12px_rgba(15,23,42,0.25),0_18px_44px_-24px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400 tabular-nums">#{index}</span>
            <span className="text-lg font-semibold text-slate-900">{word.term}</span>
            {langCode && <SpeakButton text={word.term} langCode={langCode} className="-my-1" />}
            {word.part_of_speech && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {t(`words.partsOfSpeech.${word.part_of_speech}`, { defaultValue: word.part_of_speech })}
              </span>
            )}
            {word.level && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                {word.level}
              </span>
            )}
          </div>
          {(word.phonetic || word.phonetic_native) && (
            <div className="mt-0.5 text-sm text-slate-400">
              {[word.phonetic, word.phonetic_native].filter(Boolean).join(' · ')}
            </div>
          )}

          {word.pronunciation_note_native && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t('words.fields.pronunciationNote')}
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                {word.pronunciation_note_native}
              </div>
            </div>
          )}

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

          {(word.synonyms || word.antonyms) && (
            <div className="mt-3 grid gap-2 text-xs text-left sm:grid-cols-2">
              {word.synonyms && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <span className="block font-medium text-slate-500 mb-0.5">{t('words.fields.synonyms')}</span>
                  <span className="text-slate-700">{word.synonyms}</span>
                </div>
              )}
              {word.antonyms && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <span className="block font-medium text-slate-500 mb-0.5">{t('words.fields.antonyms')}</span>
                  <span className="text-slate-700">{word.antonyms}</span>
                </div>
              )}
            </div>
          )}

          {word.word_family && (
            <div className="mt-3 border-t border-slate-100 pt-3 text-left text-xs">
              <span className="block font-medium text-slate-500 mb-1">{t('words.fields.wordFamily')}</span>
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-2 rounded">
                {word.word_family}
              </div>
            </div>
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

void WordCardLegacy

function WordCard({
  word,
  index,
  langCode,
  targetLang,
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
  langCode?: string
  targetLang?: LanguageBrief
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
  const order = new Map(allLabels.map((l, i) => [l.id, i]))
  const sortedLabels = [...word.labels].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  )
  const meaningById = new Map(word.meanings.map((m) => [m.language_id, m.value]))
  const orderedMeanings = meaningLangs
    .map((lang) => ({ lang, value: meaningById.get(lang.id) }))
    .filter((item): item is { lang: LanguageBrief; value: string } => !!item.value && item.value.trim().length > 0)

  return (
    <li className="card group p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_8px_18px_-12px_rgba(15,23,42,0.25),0_18px_44px_-24px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400 tabular-nums">#{index}</span>
            <span className="text-lg font-semibold text-slate-900">{word.term}</span>
            {langCode && <SpeakButton text={word.term} langCode={langCode} className="-my-1" />}
            {word.part_of_speech && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {t(`words.partsOfSpeech.${word.part_of_speech}`, { defaultValue: word.part_of_speech })}
              </span>
            )}
            {word.level && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                {word.level}
              </span>
            )}
          </div>

          {(word.phonetic || word.phonetic_native) && (
            <div className="mt-0.5 text-sm text-slate-400">
              {[word.phonetic, word.phonetic_native].filter(Boolean).join(' · ')}
            </div>
          )}

          {word.pronunciation_note_native && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t('words.fields.pronunciationNote')}
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                {word.pronunciation_note_native}
              </div>
            </div>
          )}

          {(orderedMeanings.length > 0 || word.definition_target) && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="space-y-2">
                {orderedMeanings.map(({ lang, value }) => (
                  <div key={lang.id}>
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      {t('words.meaningIn', { lang: langName(t, lang.code, lang.native_name || lang.name) })}
                    </span>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {value}
                    </div>
                  </div>
                ))}
                {word.definition_target && targetLang && (
                  <div>
                    <span className="mb-1 block text-xs font-medium text-slate-500">
                      {t('words.definitionIn', { lang: langName(t, targetLang.code, targetLang.native_name || targetLang.name) })}
                    </span>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {word.definition_target}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(word.synonyms || word.antonyms) && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="grid gap-2 text-left text-xs sm:grid-cols-2">
                {word.synonyms && (
                  <div>
                    <span className="mb-1 block font-medium text-slate-500">{t('words.fields.synonyms')}</span>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-700">
                      {word.synonyms}
                    </div>
                  </div>
                )}
                {word.antonyms && (
                  <div>
                    <span className="mb-1 block font-medium text-slate-500">{t('words.fields.antonyms')}</span>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-700">
                      {word.antonyms}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {word.word_family && (
            <div className="mt-3 border-t border-slate-100 pt-3 text-left text-xs">
              <span className="mb-1 block font-medium text-slate-500">{t('words.fields.wordFamily')}</span>
              <div className="whitespace-pre-wrap rounded bg-slate-50 p-2 leading-relaxed text-slate-700">
                {word.word_family}
              </div>
            </div>
          )}

          {word.example_sentence && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t('words.fields.example_sentence')}
              </span>
              <div className="border-l-2 border-slate-200 pl-3 text-sm">
                <div className="text-slate-700">{word.example_sentence}</div>
                {word.example_translation && (
                  <div className="text-slate-400">{word.example_translation}</div>
                )}
              </div>
            </div>
          )}

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
              ×
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

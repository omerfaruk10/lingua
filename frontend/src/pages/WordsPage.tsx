import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { wordsApi, type WordInput, type WordQuery } from '../api/words'
import { useConfirm } from '../components/ConfirmProvider'
import { ImportWordsModal } from '../components/ImportWordsModal'
import { labelColor } from '../components/labelColors'
import { LoadingBar } from '../components/LoadingBar'
import { SpeakButton } from '../components/SpeakButton'
import { WordForm } from '../components/WordForm'
import { WordFormDrawer } from '../components/WordFormDrawer'
import { WordPreviewDrawer } from '../components/WordPreviewDrawer'
import { useCurrentCourse, useLanguageId } from '../components/WorkspaceLayout'
import { useLabels } from '../hooks/useLabels'
import {
  useAddWordLabel,
  useCreateWord,
  useDeleteWord,
  useRemoveWordLabel,
  useSetWordStatus,
  useUpdateWord,
  useWordDetail,
  useWordPage,
  wordPageQueryOptions,
} from '../hooks/useWords'
import { downloadCsv, toCsv } from '../lib/csv'
import { buildWordCsvSchema } from '../lib/wordCsvSchema'
import type {
  Label,
  LearningStatus,
  Word,
  WordLevel,
  WordListItem,
  WordSort,
} from '../types'

const LEARNING_STATUSES: LearningStatus[] = ['new', 'learning', 'learned']
const WORD_LEVELS: WordLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'numeral',
] as const
const SORT_OPTIONS: WordSort[] = [
  'created_asc', 'created_desc', 'term_asc', 'term_desc', 'level_asc', 'level_desc',
]
const PAGE_SIZES = [5, 10, 25, 50, 100] as const
type PageSize = (typeof PAGE_SIZES)[number]
const PAGE_SIZE_KEY = 'lingua.words.pageSize'

const LEARNING_STYLE: Record<LearningStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  learning: 'bg-amber-100 text-amber-700',
  learned: 'bg-emerald-100 text-emerald-700',
}

function readPageSize(): PageSize {
  const stored = Number(localStorage.getItem(PAGE_SIZE_KEY))
  return PAGE_SIZES.includes(stored as PageSize) ? stored as PageSize : 10
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function validSort(value: string | null): WordSort {
  return SORT_OPTIONS.includes(value as WordSort) ? value as WordSort : 'created_asc'
}

const LEVEL_ORDER = new Map(WORD_LEVELS.map((level, index) => [level, index]))

function sortFullWords(words: Word[], sort: WordSort): Word[] {
  const byDate = (a: Word, b: Word) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  const byLevel = (a: Word, b: Word) =>
    (a.level ? LEVEL_ORDER.get(a.level) ?? 999 : 999) -
    (b.level ? LEVEL_ORDER.get(b.level) ?? 999 : 999)
  return [...words].sort((a, b) => {
    switch (sort) {
      case 'created_desc': return byDate(b, a) || b.id - a.id
      case 'term_asc': return a.term.localeCompare(b.term) || a.id - b.id
      case 'term_desc': return b.term.localeCompare(a.term) || b.id - a.id
      case 'level_asc': return byLevel(a, b) || a.term.localeCompare(b.term) || a.id - b.id
      case 'level_desc': return byLevel(b, a) || a.term.localeCompare(b.term) || a.id - b.id
      case 'created_asc':
      default: return byDate(a, b) || a.id - b.id
    }
  })
}

export function WordsPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const languageId = useLanguageId()
  const course = useCurrentCourse()
  const nativeLang = course?.native_language ?? null
  const helperLangs = course?.helper_languages ?? []
  const targetLang = course?.target_language ?? null
  const meaningLangs = nativeLang ? [nativeLang, ...helperLangs] : []
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const statusFilter = (searchParams.get('status') as LearningStatus | null)
  const levelFilter = (searchParams.get('level') as WordLevel | null)
  const posFilter = searchParams.get('pos')
  const labelFilter = searchParams.has('label') ? Number(searchParams.get('label')) : null
  const sortKey = validSort(searchParams.get('sort'))
  const page = positiveInt(searchParams.get('page'), 1)

  const [searchInput, setSearchInput] = useState(search)
  const [pageSize, setPageSize] = useState<PageSize>(readPageSize)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [detailWordId, setDetailWordId] = useState<number | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'preview' | 'edit'>('preview')
  const [previewNavigating, setPreviewNavigating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showExporting, setShowExporting] = useState(false)

  useEffect(() => {
    if (!exporting) {
      setShowExporting(false)
      return
    }
    const timer = window.setTimeout(() => setShowExporting(true), 150)
    return () => window.clearTimeout(timer)
  }, [exporting])

  useEffect(() => setSearchInput(search), [search])
  useEffect(() => {
    if (searchInput.trim() === search) return
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        const value = searchInput.trim()
        if (value) next.set('search', value)
        else next.delete('search')
        next.set('page', '1')
        return next
      }, { replace: true })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, searchInput, setSearchParams])

  const filters: WordQuery = {
    ...(search ? { search } : {}),
    ...(labelFilter != null && Number.isFinite(labelFilter) ? { label_id: labelFilter } : {}),
    ...(statusFilter && LEARNING_STATUSES.includes(statusFilter) ? { status: statusFilter } : {}),
    ...(levelFilter && WORD_LEVELS.includes(levelFilter) ? { level: levelFilter } : {}),
    ...(posFilter ? { part_of_speech: posFilter } : {}),
  }
  const currentPageQuery = {
    ...filters,
    page,
    page_size: pageSize,
    sort: sortKey,
  } as const
  const pageQuery = useWordPage(languageId, currentPageQuery)
  const detailQuery = useWordDetail(languageId, detailWordId)
  const { data: labels } = useLabels(languageId)
  const allLabels = labels ?? []
  const data = pageQuery.data
  const items = data?.items ?? []

  const createWord = useCreateWord(languageId)
  const updateWord = useUpdateWord(languageId)
  const deleteWord = useDeleteWord(languageId)
  const addLabel = useAddWordLabel(languageId)
  const removeLabel = useRemoveWordLabel(languageId)
  const setStatus = useSetWordStatus(languageId)

  useEffect(() => {
    if (!data) return
    if (data.total_pages > 0 && page > data.total_pages) setUrlValue('page', String(data.total_pages))
    if (data.total_pages === 0 && page !== 1) setUrlValue('page', '1')
  }, [data, page])

  function setUrlValue(key: string, value: string | null, resetPage = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (resetPage) next.set('page', '1')
      return next
    })
  }

  function create(input: WordInput, startLearning: boolean) {
    createWord.mutate(input, {
      onSuccess: (word) => {
        setAddOpen(false)
        setUrlValue('page', '1')
        if (startLearning) setStatus.mutate({ wordId: word.id, status: 'learning' })
      },
    })
  }

  function update(input: WordInput) {
    if (detailWordId == null) return
    updateWord.mutate(
      { wordId: detailWordId, data: input },
      { onSuccess: () => setDrawerMode('preview') },
    )
  }

  async function remove(wordId: number) {
    const ok = await confirm({
      message: t('words.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (!ok) return
    deleteWord.mutate(wordId, {
      onSuccess: () => {
        if (detailWordId === wordId) {
          setPreviewOpen(false)
          setDetailWordId(null)
        }
      },
    })
  }

  function openPreview(wordId: number) {
    setDrawerMode('preview')
    setDetailWordId(wordId)
    setPreviewOpen(true)
  }

  function openEdit(wordId: number) {
    setDrawerMode('edit')
    setDetailWordId(wordId)
    setPreviewOpen(true)
  }

  async function exportCsv() {
    if (!data?.total || !nativeLang || !targetLang) return
    const ok = await confirm({
      message: t('words.exportConfirm', { n: data.total }),
      confirmLabel: t('words.export'),
    })
    if (!ok) return
    setExporting(true)
    try {
      const words = sortFullWords(await wordsApi.list(languageId, filters), sortKey)
      const schema = buildWordCsvSchema(t, nativeLang, helperLangs, targetLang)
      const rows = words.map((word) => {
        const meaningCells = schema.meaningLangs.map(
          (language) => word.meanings.find((meaning) => meaning.language_id === language.id)?.value ?? '',
        )
        return [
          word.term, word.part_of_speech, word.level, word.phonetic, word.phonetic_native,
          word.pronunciation_note_native, ...meaningCells, word.definition_target,
          word.synonyms, word.antonyms, word.word_family, word.example_sentence,
          word.example_translation,
        ].map((value) => value ?? '')
      })
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(
        `lingua-${course?.code ?? 'words'}-words-${date}.csv`,
        toCsv([schema.headers, ...rows]),
      )
    } finally {
      setExporting(false)
    }
  }

  function changePageSize(nextSize: PageSize) {
    const firstVisibleIndex = (page - 1) * pageSize
    const nextPage = Math.floor(firstVisibleIndex / nextSize) + 1
    setPageSize(nextSize)
    localStorage.setItem(PAGE_SIZE_KEY, String(nextSize))
    setUrlValue('page', String(nextPage))
  }

  const activeExtraFilters =
    (levelFilter ? 1 : 0) + (posFilter ? 1 : 0) + (labelFilter != null ? 1 : 0)
  const selectedIndex = items.findIndex((item) => item.id === detailWordId)
  const hasPreviousPreview = selectedIndex > 0 || page > 1
  const hasNextPreview = selectedIndex >= 0 && (
    selectedIndex < items.length - 1 || page < (data?.total_pages ?? 0)
  )

  useEffect(() => {
    if (!previewOpen || drawerMode !== 'preview' || !data || pageQuery.isPlaceholderData) return
    const adjacentPages = [page - 1, page + 1].filter(
      (candidate) => candidate >= 1 && candidate <= data.total_pages,
    )
    for (const adjacentPage of adjacentPages) {
      queryClient.prefetchQuery(wordPageQueryOptions(languageId, {
        ...filters,
        page: adjacentPage,
        page_size: pageSize,
        sort: sortKey,
      }))
    }
  }, [
    data?.total_pages,
    drawerMode,
    labelFilter,
    languageId,
    levelFilter,
    page,
    pageQuery.isPlaceholderData,
    pageSize,
    posFilter,
    previewOpen,
    queryClient,
    search,
    sortKey,
    statusFilter,
  ])

  async function navigatePreview(direction: -1 | 1) {
    if (previewNavigating || selectedIndex < 0 || !data) return
    const localTarget = items[selectedIndex + direction]
    if (localTarget) {
      setDetailWordId(localTarget.id)
      return
    }

    const targetPage = page + direction
    if (targetPage < 1 || targetPage > data.total_pages) return
    setPreviewNavigating(true)
    try {
      const targetData = await queryClient.fetchQuery(wordPageQueryOptions(languageId, {
        ...filters,
        page: targetPage,
        page_size: pageSize,
        sort: sortKey,
      }))
      const targetWord = direction === 1
        ? targetData.items[0]
        : targetData.items[targetData.items.length - 1]
      if (!targetWord) return
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.set('page', String(targetPage))
        return next
      }, { replace: true })
      setDetailWordId(targetWord.id)
    } finally {
      setPreviewNavigating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 xl:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('words.searchPlaceholder')}
            className="input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCsv}
            disabled={!data?.total || exporting}
            aria-busy={exporting}
            className="btn-ghost relative shrink-0 overflow-hidden"
          >
            <span className={showExporting ? 'export-icon-active' : ''}><ExportIcon /></span>
            <span>{showExporting ? t('words.exporting') : t('words.export')}</span>
            {showExporting && (
              <span className="export-loading-track" role="progressbar" aria-label={t('words.exporting')}>
                <span className="export-loading-line" />
              </span>
            )}
          </button>
          <button onClick={() => setImportOpen(true)} className="btn-ghost shrink-0">
            <ImportIcon />
            {t('words.import')}
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary shrink-0">
            + {t('words.add')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={!statusFilter} onClick={() => setUrlValue('status', null, true)}>
            {t('learning.all')}
          </FilterChip>
          {LEARNING_STATUSES.map((status) => (
            <FilterChip
              key={status}
              active={statusFilter === status}
              onClick={() => setUrlValue('status', statusFilter === status ? null : status, true)}
            >
              {t(`learning.${status}`)}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 sm:justify-start">
          <WordFilterMenu
            labels={allLabels}
            levelFilter={levelFilter}
            posFilter={posFilter}
            labelFilter={labelFilter}
            activeCount={activeExtraFilters}
            onLevel={(value) => setUrlValue('level', value, true)}
            onPos={(value) => setUrlValue('pos', value, true)}
            onLabel={(value) => setUrlValue('label', value == null ? null : String(value), true)}
          />
          <WordSortMenu sortKey={sortKey} onSort={(value) => setUrlValue('sort', value, true)} />
        </div>
      </div>

      {activeExtraFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {levelFilter && (
            <ActiveFilterChip onClear={() => setUrlValue('level', null, true)}>
              {t('words.fields.level')}: {levelFilter}
            </ActiveFilterChip>
          )}
          {posFilter && (
            <ActiveFilterChip onClear={() => setUrlValue('pos', null, true)}>
              {t('words.fields.part_of_speech')}: {t(`words.partsOfSpeech.${posFilter}`, { defaultValue: posFilter })}
            </ActiveFilterChip>
          )}
          {labelFilter != null && (
            <ActiveFilterChip onClear={() => setUrlValue('label', null, true)}>
              {t('labels.filterByLabel')}: {allLabels.find((label) => label.id === labelFilter)?.name ?? labelFilter}
            </ActiveFilterChip>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
        <span>{t('words.resultCount', { n: data?.total ?? 0 })}</span>
      </div>

      <LoadingBar active={pageQuery.isFetching} label={t('common.loading')} />

      {pageQuery.isLoading ? (
        <div className="min-h-48" />
      ) : pageQuery.isError ? (
        <div className="card border-rose-100 bg-rose-50/60 p-6 text-center text-sm text-rose-700">
          {t('common.error')}
        </div>
      ) : items.length === 0 ? (
        <div className="card mx-auto flex w-full max-w-2xl flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">{search || activeExtraFilters ? '⌕' : '▤'}</span>
          <p className="text-slate-400">{search || activeExtraFilters ? t('words.noResults') : t('words.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5" aria-busy={pageQuery.isFetching}>
          {items.map((word, index) => (
            <WordListRow
              key={word.id}
              word={word}
              position={(page - 1) * pageSize + index + 1}
              langCode={targetLang?.code}
              onPreview={() => openPreview(word.id)}
              onEdit={() => openEdit(word.id)}
              onDelete={() => remove(word.id)}
              onSetStatus={(status) => setStatus.mutate({ wordId: word.id, status })}
            />
          ))}
        </ul>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          totalPages={data.total_pages}
          onPage={(value) => setUrlValue('page', String(value))}
          onPageSize={changePageSize}
        />
      )}

      {addOpen && nativeLang && targetLang && (
        <WordFormDrawer
          title={t('words.addTitle')}
          formId="word-drawer-add-form"
          submitting={createWord.isPending}
          submitLabel={t('words.add')}
          submittingLabel={t('common.adding')}
          onClose={() => setAddOpen(false)}
        >
          <WordForm
            bare hideActions formId="word-drawer-add-form"
            courseId={languageId} nativeLang={nativeLang} helperLangs={helperLangs}
            targetLang={targetLang} submitLabel={t('words.add')} submitting={createWord.isPending}
            showStartLearning onSubmit={create}
          />
        </WordFormDrawer>
      )}

      {importOpen && (
        <ImportWordsModal
          courseId={languageId} nativeLang={nativeLang} helperLangs={helperLangs}
          targetLang={targetLang} onClose={() => setImportOpen(false)}
        />
      )}

      {previewOpen && (
        <WordPreviewDrawer
          word={detailQuery.data}
          loading={detailQuery.isLoading}
          mode={drawerMode}
          navigating={previewNavigating}
          editContent={detailQuery.data && nativeLang && targetLang ? (
            <WordForm
              bare
              formId="word-drawer-edit-form"
              hideActions
              initial={detailQuery.data}
              courseId={languageId}
              nativeLang={nativeLang}
              helperLangs={helperLangs}
              targetLang={targetLang}
              submitLabel={t('common.save')}
              submitting={updateWord.isPending}
              onSubmit={update}
            />
          ) : undefined}
          editFormId="word-drawer-edit-form"
          editSubmitting={updateWord.isPending}
          langCode={targetLang?.code}
          meaningLangs={meaningLangs}
          targetLang={targetLang ?? undefined}
          allLabels={allLabels}
          hasPrevious={hasPreviousPreview}
          hasNext={hasNextPreview}
          onPrevious={() => navigatePreview(-1)}
          onNext={() => navigatePreview(1)}
          onAddLabel={(labelId) => detailWordId != null && addLabel.mutate({ wordId: detailWordId, labelId })}
          onRemoveLabel={(labelId) => detailWordId != null && removeLabel.mutate({ wordId: detailWordId, labelId })}
          onEdit={() => setDrawerMode('edit')}
          onCancelEdit={() => setDrawerMode('preview')}
          onDelete={() => detailWordId != null && remove(detailWordId)}
          onClose={() => { setPreviewOpen(false); setDrawerMode('preview') }}
        />
      )}
    </div>
  )
}

function WordListRow({
  word,
  position,
  langCode,
  onPreview,
  onEdit,
  onDelete,
  onSetStatus,
}: {
  word: WordListItem
  position: number
  langCode?: string
  onPreview: () => void
  onEdit: () => void
  onDelete: () => void
  onSetStatus: (status: LearningStatus) => void
}) {
  const { t } = useTranslation()
  const visibleLabels = word.labels.slice(0, 2)
  const remainingLabels = Math.max(0, word.labels.length - visibleLabels.length)

  function action(event: React.MouseEvent, callback: () => void) {
    event.stopPropagation()
    callback()
  }

  return (
    <li
      className="group relative cursor-pointer rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-md focus-within:z-50 focus-within:border-violet-300 sm:p-4"
      onClick={onPreview}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) onPreview()
      }}
      tabIndex={0}
    >
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2 sm:gap-x-3 lg:grid-cols-[3rem_minmax(12rem,1.45fr)_minmax(11rem,1fr)_minmax(10rem,1fr)_auto_auto] lg:gap-3">
        <span className="row-span-2 self-start pt-1 text-sm font-semibold tabular-nums text-slate-400 lg:row-auto lg:self-auto lg:pt-0">#{position}</span>

        <div className="min-w-0 lg:col-auto lg:row-auto">
          <div className="truncate text-base font-semibold text-slate-900 sm:text-lg">{word.term}</div>
          <div className="truncate text-sm text-slate-500">{word.primary_meaning || '—'}</div>
        </div>

        <div className="col-start-2 row-start-2 flex min-w-0 items-center gap-2 lg:col-auto lg:row-auto">
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate text-slate-600">{word.phonetic || '—'}</div>
            <div className="truncate text-xs text-slate-400">{word.phonetic_native || '—'}</div>
          </div>
          {langCode && <SpeakButton text={word.term} langCode={langCode} className="shrink-0" />}
        </div>

        <div className="col-start-2 row-start-3 flex min-w-0 flex-wrap items-center gap-1.5 lg:col-auto lg:row-auto">
          {word.level && <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600">{word.level}</span>}
          {word.part_of_speech && (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {t(`words.partsOfSpeech.${word.part_of_speech}`, { defaultValue: word.part_of_speech })}
            </span>
          )}
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              style={{ backgroundColor: labelColor(label.color) }}
              className="max-w-24 truncate rounded-full px-2 py-1 text-[11px] font-medium text-white"
            >
              {label.name}
            </span>
          ))}
          {remainingLabels > 0 && <span className="text-xs font-medium text-slate-400">+{remainingLabels}</span>}
        </div>

        <div className="col-start-2 row-start-4 flex min-w-0 items-center justify-between gap-2 lg:contents">
          <div className="min-w-0 lg:col-auto lg:row-auto" onClick={(event) => event.stopPropagation()}>
            <WordStatusDropdown status={word.learning_status} onSetStatus={onSetStatus} />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 lg:col-auto lg:row-auto">
            <button type="button" onClick={(event) => action(event, onPreview)} className="btn-icon" title={t('words.preview')} aria-label={t('words.preview')}>
              <EyeIcon />
            </button>
            <button type="button" onClick={(event) => action(event, onEdit)} className="btn-icon" title={t('common.edit')} aria-label={t('common.edit')}>
              <PencilIcon />
            </button>
            <button
              type="button"
              onClick={(event) => action(event, onDelete)}
              className="btn-icon text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              title={t('common.delete')}
              aria-label={t('common.delete')}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m13.8 7.4 3 3" />
    </svg>
  )
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path className="export-icon-arrow" d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="export-icon-tray" d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" />
    </svg>
  )
}

function WordStatusDropdown({
  status,
  onSetStatus,
}: {
  status: LearningStatus
  onSetStatus: (status: LearningStatus) => void
}) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function pick(nextStatus: LearningStatus) {
    setOpen(false)
    if (nextStatus === status) return
    const reset = status === 'learned' && nextStatus !== 'learned'
    const ok = await confirm({
      message: t(reset ? 'learning.resetConfirm' : 'learning.changeConfirm', {
        status: t(`learning.${nextStatus}`),
      }),
      confirmLabel: t('common.yes'),
      danger: reset,
    })
    if (ok) onSetStatus(nextStatus)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${LEARNING_STYLE[status]}`}
      >
        {t(`learning.${status}`)} <span className="opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-[60] mt-1 min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {LEARNING_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pick(option)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 ${option === status ? 'text-violet-700' : 'text-slate-600'}`}
            >
              <span className="w-3">{option === status ? '✓' : ''}</span>
              {t(`learning.${option}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  onPageSize,
}: {
  page: number
  pageSize: PageSize
  total: number
  totalPages: number
  onPage: (page: number) => void
  onPageSize: (size: PageSize) => void
}) {
  const { t } = useTranslation()
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  let first = Math.max(1, page - 2)
  const last = Math.min(totalPages, first + 4)
  first = Math.max(1, last - 4)
  const pages = Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index)
  return (
    <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-slate-500">{t('words.resultRange', { start, end, total })}</span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>{t('words.perPage')}</span>
          <PageSizeSelect value={pageSize} onChange={onPageSize} />
        </div>
        <nav className="flex items-center gap-1" aria-label={t('words.pagination')}>
          <button type="button" className="btn-icon" disabled={page <= 1} onClick={() => onPage(page - 1)} title={t('words.previousPage')}>‹</button>
          {first > 1 && <><PageButton value={1} current={page} onPage={onPage} /><span className="px-1 text-slate-300">…</span></>}
          {pages.map((value) => <PageButton key={value} value={value} current={page} onPage={onPage} />)}
          {last < totalPages && <><span className="px-1 text-slate-300">…</span><PageButton value={totalPages} current={page} onPage={onPage} /></>}
          <button type="button" className="btn-icon" disabled={page >= totalPages} onClick={() => onPage(page + 1)} title={t('words.nextPage')}>›</button>
        </nav>
      </div>
    </div>
  )
}

function PageSizeSelect({ value, onChange }: { value: PageSize; onChange: (size: PageSize) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        className={`flex min-w-20 cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition ${
          open
            ? 'border-violet-300 ring-4 ring-violet-500/10'
            : 'border-slate-200 hover:border-violet-200 hover:bg-white'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="tabular-nums">{value}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              role="option"
              aria-selected={size === value}
              onClick={() => { onChange(size); setOpen(false) }}
              className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm tabular-nums transition ${
                size === value
                  ? 'bg-violet-50 font-semibold text-violet-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {size}
              {size === value && <span className="text-xs text-violet-500">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PageButton({ value, current, onPage }: { value: number; current: number; onPage: (page: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPage(value)}
      disabled={value === current}
      aria-current={value === current ? 'page' : undefined}
      className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-medium transition ${value === current ? 'cursor-default bg-violet-600 text-white' : 'cursor-pointer text-slate-500 hover:bg-violet-50 hover:text-violet-700'}`}
    >
      {value}
    </button>
  )
}

function FilterChip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800'}`}
    >
      {children}
    </button>
  )
}

function ActiveFilterChip({ onClear, children }: { onClear: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClear} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-violet-200 hover:text-violet-700">
      {children} <span className="ml-1 text-slate-300">×</span>
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
  onPos: (position: string | null) => void
  onLabel: (labelId: number | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="btn-ghost px-3">
        {t('words.filters')}
        {activeCount > 0 && <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">{activeCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <FilterSection title={t('words.fields.level')}>
            <FilterChip active={!levelFilter} onClick={() => onLevel(null)}>{t('learning.all')}</FilterChip>
            {WORD_LEVELS.map((level) => <FilterChip key={level} active={levelFilter === level} onClick={() => onLevel(level)}>{level}</FilterChip>)}
          </FilterSection>
          <FilterSection title={t('words.fields.part_of_speech')}>
            <FilterChip active={!posFilter} onClick={() => onPos(null)}>{t('learning.all')}</FilterChip>
            {PARTS_OF_SPEECH.map((position) => (
              <FilterChip key={position} active={posFilter === position} onClick={() => onPos(position)}>
                {t(`words.partsOfSpeech.${position}`)}
              </FilterChip>
            ))}
          </FilterSection>
          <FilterSection title={t('labels.filterByLabel')}>
            <FilterChip active={labelFilter == null} onClick={() => onLabel(null)}>{t('labels.all')}</FilterChip>
            {labels.map((label) => (
              <FilterChip key={label.id} active={labelFilter === label.id} color={labelColor(label.color)} onClick={() => onLabel(label.id)}>
                {label.name}
              </FilterChip>
            ))}
          </FilterSection>
        </div>
      )}
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-3 last:mb-0"><h3 className="mb-1.5 text-xs font-semibold text-slate-500">{title}</h3><div className="flex flex-wrap gap-1.5">{children}</div></section>
}

function WordSortMenu({ sortKey, onSort }: { sortKey: WordSort; onSort: (sort: WordSort) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="btn-ghost px-3">{t('words.sort')}</button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => { onSort(option); setOpen(false) }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${sortKey === option ? 'text-violet-700' : 'text-slate-600'}`}
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

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { WordInput } from '../api/words'
import { LabelBadge } from '../components/LabelBadge'
import { labelColor } from '../components/labelColors'
import { WordForm } from '../components/WordForm'
import { useLanguageId } from '../components/WorkspaceLayout'
import { useLabels } from '../hooks/useLabels'
import {
  useAddWordLabel,
  useCreateWord,
  useDeleteWord,
  useRemoveWordLabel,
  useUpdateWord,
  useWords,
} from '../hooks/useWords'
import type { Label, Word } from '../types'

export function WordsPage() {
  const { t } = useTranslation()
  const languageId = useLanguageId()
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<number | null>(null)

  const query = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(labelFilter != null ? { label_id: labelFilter } : {}),
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

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const list = words ?? []
  const allLabels = labels ?? []

  function create(data: WordInput) {
    createWord.mutate(data, { onSuccess: () => setAdding(false) })
  }
  function update(data: WordInput) {
    if (editingId == null) return
    updateWord.mutate({ wordId: editingId, data }, { onSuccess: () => setEditingId(null) })
  }
  function remove(wordId: number) {
    if (confirm(t('words.deleteConfirm'))) deleteWord.mutate(wordId)
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
        {!adding && (
          <button
            onClick={() => {
              setAdding(true)
              setEditingId(null)
            }}
            className="btn-primary shrink-0"
          >
            + {t('words.add')}
          </button>
        )}
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

      {adding && (
        <WordForm
          title={t('words.addTitle')}
          submitLabel={t('words.add')}
          submitting={createWord.isPending}
          onSubmit={create}
          onCancel={() => setAdding(false)}
        />
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
          {list.map((word) =>
            editingId === word.id ? (
              <li key={word.id}>
                <WordForm
                  initial={word}
                  title={t('words.editTitle')}
                  submitLabel={t('common.save')}
                  submitting={updateWord.isPending}
                  onSubmit={update}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <WordCard
                key={word.id}
                word={word}
                allLabels={allLabels}
                onAddLabel={(labelId) => addLabel.mutate({ wordId: word.id, labelId })}
                onRemoveLabel={(labelId) => removeLabel.mutate({ wordId: word.id, labelId })}
                onEdit={() => {
                  setEditingId(word.id)
                  setAdding(false)
                }}
                onDelete={() => remove(word.id)}
              />
            ),
          )}
        </ul>
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

function WordCard({
  word,
  allLabels,
  onAddLabel,
  onRemoveLabel,
  onEdit,
  onDelete,
}: {
  word: Word
  allLabels: Label[]
  onAddLabel: (labelId: number) => void
  onRemoveLabel: (labelId: number) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const available = allLabels.filter((l) => !word.labels.some((wl) => wl.id === l.id))

  return (
    <li className="card group p-4 transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900">{word.term}</span>
            {word.part_of_speech && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {word.part_of_speech}
              </span>
            )}
            {(word.phonetic || word.phonetic_tr) && (
              <span className="text-sm text-slate-400">
                {[word.phonetic, word.phonetic_tr].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>

          {(word.meaning_native || word.meaning_english) && (
            <div className="mt-1 text-slate-700">
              {word.meaning_native}
              {word.meaning_english && (
                <span className="text-slate-400"> · {word.meaning_english}</span>
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
            {word.labels.map((label) => (
              <LabelBadge key={label.id} label={label} onRemove={() => onRemoveLabel(label.id)} />
            ))}
            <div className="relative">
              <button
                onClick={() => setPicking((p) => !p)}
                className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-400 hover:border-violet-400 hover:text-violet-600"
              >
                + {t('labels.addToWord')}
              </button>
              {picking && (
                <div className="absolute z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                  {available.length === 0 ? (
                    <p className="px-1 py-0.5 text-xs text-slate-400">{t('labels.noneToAdd')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {available.map((label) => (
                        <button
                          key={label.id}
                          onClick={() => {
                            onAddLabel(label.id)
                            setPicking(false)
                          }}
                          style={{ backgroundColor: labelColor(label.color) }}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white hover:opacity-80"
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={onEdit} className="btn-icon" title={t('common.edit')}>
            ✎
          </button>
          <button onClick={onDelete} className="btn-icon-danger" title={t('common.delete')}>
            ✕
          </button>
        </div>
      </div>
    </li>
  )
}

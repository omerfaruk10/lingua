import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { LanguageInput } from '../api/languages'
import { useConfirm } from '../components/ConfirmProvider'
import { Modal } from '../components/Modal'
import {
  useCreateLanguage,
  useDeleteLanguage,
  useLanguages,
  useUpdateLanguage,
} from '../hooks/useLanguages'
import { setSelectedLanguageId } from '../lib/selectedLanguage'
import type { Language } from '../types'

const EMPTY: LanguageInput = { code: '', name: '', native_name: '' }

export function LanguagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { data: languages, isLoading } = useLanguages()
  const createLang = useCreateLanguage()
  const updateLang = useUpdateLanguage()
  const deleteLang = useDeleteLanguage()

  const [manage, setManage] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Language | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)

  const list = languages ?? []
  const activeLang = activeId != null ? list.find((l) => l.id === activeId) : null

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function open(id: number) {
    setSelectedLanguageId(id)
    navigate(`/lang/${id}/topics`)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = list.findIndex((l) => l.id === active.id)
    const newIndex = list.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(list, oldIndex, newIndex)
    reordered.forEach((lang, pos) => {
      if (lang.order_index !== pos) updateLang.mutate({ id: lang.id, data: { order_index: pos } })
    })
  }

  async function remove(lang: Language) {
    const ok = await confirm({
      message: t('languages.deleteConfirm', { name: lang.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (ok) deleteLang.mutate(lang.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('languages.title')}
          </h1>
          <p className="mt-1 text-slate-500">{t('languages.subtitle')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {list.length > 0 && (
            <button onClick={() => setManage((m) => !m)} className="btn-ghost px-3 py-2">
              {manage ? t('languages.done') : t('languages.manage')}
            </button>
          )}
          <button onClick={() => setAddOpen(true)} className="btn-primary px-3 py-2">
            + {t('languages.create')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">🌍</span>
          <p className="text-slate-400">{t('languages.empty')}</p>
        </div>
      ) : manage ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={list.map((l) => l.id)} strategy={rectSortingStrategy}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((lang) => (
                <SortableLangCard
                  key={lang.id}
                  lang={lang}
                  onEdit={() => setEditing(lang)}
                  onDelete={() => remove(lang)}
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>

          <DragOverlay>
            {activeLang && <LangCardOverlay lang={activeLang} />}
          </DragOverlay>
        </DndContext>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((lang) => (
            <li
              key={lang.id}
              onClick={() => open(lang.id)}
              className="card group flex cursor-pointer items-center gap-3.5 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_16px_32px_-16px_rgba(124,108,240,0.30)]"
            >
              <Monogram code={lang.code} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-800">{lang.name}</div>
                <div className="truncate text-sm text-slate-500">{lang.native_name}</div>
              </div>
              <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500">
                →
              </span>
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <Modal title={t('languages.addTitle')} onClose={() => setAddOpen(false)}>
          <LanguageForm
            submitLabel={t('languages.create')}
            submitting={createLang.isPending}
            error={createLang.error}
            onSubmit={(data) => createLang.mutate(data, { onSuccess: () => setAddOpen(false) })}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={t('languages.editTitle')} onClose={() => setEditing(null)}>
          <LanguageForm
            initial={editing}
            submitLabel={t('common.save')}
            submitting={updateLang.isPending}
            error={updateLang.error}
            onSubmit={(data) =>
              updateLang.mutate({ id: editing.id, data }, { onSuccess: () => setEditing(null) })
            }
          />
        </Modal>
      )}
    </div>
  )
}

function SortableLangCard({
  lang,
  onEdit,
  onDelete,
  t,
}: {
  lang: Language
  onEdit: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lang.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? 'transform 700ms ease' : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`card flex items-center gap-3 p-3.5 transition ${
        isDragging ? 'invisible' : 'hover:border-slate-300'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-lg leading-none text-slate-300 hover:text-violet-500 active:cursor-grabbing"
        title="Sürükle"
      >
        ⠿
      </button>
      <Monogram code={lang.code} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-800">{lang.name}</div>
        <div className="truncate text-sm text-slate-500">{lang.native_name}</div>
      </div>
      <button onClick={onEdit} className="btn-icon" title={t('common.edit')}>
        ✎
      </button>
      <button onClick={onDelete} className="btn-icon-danger" title={t('common.delete')}>
        ✕
      </button>
    </li>
  )
}

function LangCardOverlay({ lang }: { lang: Language }) {
  return (
    <div className="card flex cursor-grabbing items-center gap-3 p-3.5 shadow-2xl ring-2 ring-violet-400/40">
      <span className="text-lg leading-none text-violet-400">⠿</span>
      <Monogram code={lang.code} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-800">{lang.name}</div>
        <div className="truncate text-sm text-slate-500">{lang.native_name}</div>
      </div>
    </div>
  )
}

function Monogram({ code }: { code: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 text-sm font-semibold uppercase text-violet-600">
      {code.slice(0, 2)}
    </span>
  )
}

function LanguageForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: {
  initial?: Language
  submitLabel: string
  submitting: boolean
  error: unknown
  onSubmit: (data: LanguageInput) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<LanguageInput>(
    initial
      ? { code: initial.code, name: initial.name, native_name: initial.native_name }
      : EMPTY,
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim() || !form.native_name.trim()) return
    onSubmit({
      code: form.code.trim(),
      name: form.name.trim(),
      native_name: form.native_name.trim(),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label={t('languages.code')}
        hint={t('languages.codeHint')}
        value={form.code}
        onChange={(v) => setForm((f) => ({ ...f, code: v }))}
        autoFocus
      />
      <Field
        label={t('languages.name')}
        hint={t('languages.nameHint')}
        value={form.name}
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
      />
      <Field
        label={t('languages.nativeName')}
        hint={t('languages.nativeNameHint')}
        value={form.native_name}
        onChange={(v) => setForm((f) => ({ ...f, native_name: v }))}
      />
      {error != null && <p className="text-sm text-red-500">{(error as Error).message}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitLabel}
      </button>
    </form>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  autoFocus,
}: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
        autoFocus={autoFocus}
        className="input"
      />
    </label>
  )
}

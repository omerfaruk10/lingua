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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { CourseInput, CourseUpdate, LangRef } from '../api/languages'
import { useConfirm } from '../components/ConfirmProvider'
import { LoadingState } from '../components/LoadingBar'
import { Modal } from '../components/Modal'
import {
  useCatalog,
  useCreateLanguage,
  useDeleteLanguage,
  useLanguages,
  useUpdateLanguage,
} from '../hooks/useLanguages'
import { translateApiError } from '../lib/apiErrors'
import { courseSlug } from '../lib/courseSlug'
import { langName } from '../lib/langName'
import { setSelectedCourseSlug } from '../lib/selectedLanguage'
import type { Language, LanguageBrief } from '../types'

const MAX_HELPERS = 3

export function LanguagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { data: languages, isLoading } = useLanguages()
  const { data: catalog } = useCatalog()
  const createLang = useCreateLanguage()
  const updateLang = useUpdateLanguage()
  const deleteLang = useDeleteLanguage()

  const [manage, setManage] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Language | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)

  const list = languages ?? []
  const catalogList = catalog ?? []
  const activeLang = activeId != null ? list.find((l) => l.id === activeId) : null

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function open(lang: Language) {
    const slug = courseSlug(lang)
    setSelectedCourseSlug(slug)
    navigate(`/languages/${slug}/topics`)
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

  // Hedef ve ana dil icin tum katalog (standart diller) secilebilir.
  const targetOptions = catalogList

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('languages.title')}
          </h1>
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
        <LoadingState label={t('common.loading')} />
      ) : list.length === 0 ? (
        <div className="card mx-auto w-full max-w-2xl flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
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
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {list.map((lang) => (
                <SortableLangCard
                  key={lang.id}
                  lang={lang}
                  onEdit={() => setEditing(lang)}
                  onDelete={() => remove(lang)}
                />
              ))}
            </ul>
          </SortableContext>

          <DragOverlay>
            {activeLang && <LangCardOverlay lang={activeLang} />}
          </DragOverlay>
        </DndContext>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((lang) => (
            <li
              key={lang.id}
              onClick={() => open(lang)}
              className="card group flex cursor-pointer items-center gap-3.5 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_16px_32px_-16px_rgba(124,108,240,0.30)]"
            >
              <Monogram code={lang.code} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-800">
                  {langName(t, lang.code, lang.name)}
                </div>
                <div className="truncate text-sm text-slate-500">{lang.native_name}</div>
                <CourseMeta lang={lang} />
              </div>
              <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500">
                →
              </span>
            </li>
          ))}
        </ul>
      )}

      {addOpen && (
        <Modal title={t('languages.addTitle')} onClose={() => { setAddOpen(false); createLang.reset() }}>
          <CourseForm
            targetOptions={targetOptions}
            catalog={catalogList}
            submitLabel={t('languages.create')}
            submitting={createLang.isPending}
            error={createLang.error}
            onSubmit={(data) => createLang.mutate(data, { onSuccess: () => setAddOpen(false) })}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={t('languages.editTitle')} onClose={() => { setEditing(null); updateLang.reset() }}>
          <CourseForm
            editing={editing}
            targetOptions={targetOptions}
            catalog={catalogList}
            submitLabel={t('common.save')}
            submitting={updateLang.isPending}
            error={updateLang.error}
            onSubmitUpdate={(data) =>
              updateLang.mutate({ id: editing.id, data }, { onSuccess: () => setEditing(null) })
            }
          />
        </Modal>
      )}
    </div>
  )
}

function CourseMeta({ lang }: { lang: Language }) {
  const { t } = useTranslation()
  const nativeName = langName(t, lang.native_language.code, lang.native_language.native_name)
  const helpers = lang.helper_languages.map((h) => langName(t, h.code, h.name)).join(', ')
  return (
    <div className="mt-0.5 truncate text-xs text-slate-400">
      {t('languages.nativeLabel')}: {nativeName}
      {helpers && ` · ${t('languages.helperLabel')}: ${helpers}`}
    </div>
  )
}

// ---- Kurs formu (hedef + ana dil + yardimci diller) ----

function CourseForm({
  editing,
  targetOptions,
  catalog,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onSubmitUpdate,
}: {
  editing?: Language
  targetOptions: LanguageBrief[]
  catalog: LanguageBrief[]
  submitLabel: string
  submitting: boolean
  error: unknown
  onSubmit?: (data: CourseInput) => void
  onSubmitUpdate?: (data: CourseUpdate) => void
}) {
  const { t } = useTranslation()

  const [target, setTarget] = useState<LangRef | null>(null)
  const [native, setNative] = useState<LangRef | null>(
    editing?.native_language ? { id: editing.native_language.id } : null,
  )
  const [helpers, setHelpers] = useState<(LangRef | null)[]>(
    editing ? editing.helper_languages.map((h) => ({ id: h.id })) : [],
  )

  function refValid(ref: LangRef | null): boolean {
    return ref != null && (ref.id != null || !!(ref.code && ref.code.trim()))
  }

  function cleanHelpers(): LangRef[] {
    return helpers.filter(refValid) as LangRef[]
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!refValid(native)) return
    if (editing && onSubmitUpdate) {
      onSubmitUpdate({ native: native!, helpers: cleanHelpers() })
      return
    }
    if (!refValid(target) || !onSubmit) return
    onSubmit({ target: target!, native: native!, helpers: cleanHelpers() })
  }

  function addHelper() {
    if (helpers.length < MAX_HELPERS) setHelpers((h) => [...h, null])
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {editing ? (
        // Hedef dil olusturulduktan sonra degistirilemez (yeni kurs olarak eklenir).
        <div className="block">
          <span className="field-label">
            {t('languages.targetLang')}
            <span className="text-violet-500"> *</span>
          </span>
          <div className="input flex min-h-[2.875rem] items-center bg-slate-50 text-slate-500">
            {langName(t, editing.code, editing.name)} ({editing.code})
          </div>
        </div>
      ) : (
        <div className="block">
          <span className="field-label">
            {t('languages.targetLang')}
            <span className="text-violet-500"> *</span>
          </span>
          <LangPicker options={targetOptions} value={target} onChange={setTarget} />
        </div>
      )}

      <div className="block">
        <span className="field-label">
          {t('languages.nativeLang')}
          <span className="text-violet-500"> *</span>
        </span>
        <LangPicker options={catalog} value={native} onChange={setNative} />
      </div>

      <div className="block">
        <span className="field-label">{t('languages.helperLangs')}</span>
        <div className="space-y-2">
          {helpers.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <LangPicker
                  options={catalog}
                  value={h}
                  onChange={(v) => setHelpers((arr) => arr.map((x, j) => (j === i ? v : x)))}
                />
              </div>
              <button
                type="button"
                onClick={() => setHelpers((arr) => arr.filter((_, j) => j !== i))}
                className="btn-icon-danger mt-1"
                title={t('common.delete')}
              >
                ✕
              </button>
            </div>
          ))}
          {helpers.length < MAX_HELPERS && (
            <button type="button" onClick={addHelper} className="btn-ghost text-sm">
              + {t('languages.addHelper')}
            </button>
          )}
        </div>
      </div>

      {error != null && <p className="text-sm text-red-500">{translateApiError(t, error)}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitLabel}
      </button>
    </form>
  )
}

// Tek dil secici: aranabilir combobox (tur secimi gibi). Katalogtan sec ya da
// 'o anlik' yeni dil ekle. Placeholder yok; secili degilse bos gorunur.
function LangPicker({
  options,
  value,
  onChange,
}: {
  options: LanguageBrief[]
  value: LangRef | null
  onChange: (v: LangRef | null) => void
}) {
  const { t } = useTranslation()
  const isNew = value != null && value.id == null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value?.id != null ? options.find((o) => o.id === value.id) : undefined
  const label = selected ? `${langName(t, selected.code, selected.name)} (${selected.code})` : ''

  // Diakritik/Turkce İ duyarsiz arama ("ital" -> "İtalyanca" eslessin).
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const filtered = options.filter((o) =>
    norm(`${langName(t, o.code, o.name)} ${o.name} ${o.code}`).includes(norm(query)),
  )

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function openDropdown() {
    setOpen(true)
    setQuery('')
    setTimeout(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.select() }
    }, 0)
  }

  function select(o: LanguageBrief) {
    onChange({ id: o.id })
    setOpen(false)
    setQuery('')
  }

  function startNew() {
    onChange({ code: '', name: '', native_name: '' })
    setOpen(false)
    setQuery('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  // 'O anlik' yeni dil: 3 alanli mini form + vazgec.
  if (isNew) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-2">
        <div className="grid grid-cols-3 gap-2">
          <input
            value={value?.code ?? ''}
            onChange={(e) => onChange({ ...value, code: e.target.value })}
            placeholder={t('languages.code')}
            className="input"
            autoFocus
          />
          <input
            value={value?.name ?? ''}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder={t('languages.name')}
            className="input"
          />
          <input
            value={value?.native_name ?? ''}
            onChange={(e) => onChange({ ...value, native_name: e.target.value })}
            placeholder={t('languages.nativeName')}
            className="input"
          />
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-xs text-slate-400 hover:text-slate-600">
          ‹ {t('common.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      {open ? (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery('') }
            if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); select(filtered[0]) }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={openDropdown}
          className="input flex min-h-[2.875rem] items-center justify-between text-left w-full cursor-text"
        >
          <span className="text-slate-800">{label || ' '}</span>
          {value?.id != null && (
            <span
              onClick={clear}
              className="text-slate-400 hover:text-slate-600 px-0.5 leading-none text-base cursor-pointer"
              role="button"
              aria-label={t('common.delete')}
            >
              ×
            </span>
          )}
        </button>
      )}

      {open && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.map((o) => (
            <li
              key={o.id}
              onMouseDown={() => select(o)}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-violet-50 hover:text-violet-700 ${
                o.id === value?.id ? 'bg-violet-50 font-medium text-violet-700' : 'text-slate-700'
              }`}
            >
              {langName(t, o.code, o.name)} <span className="text-slate-400">({o.code})</span>
            </li>
          ))}
          <li
            onMouseDown={startNew}
            className="cursor-pointer border-t border-slate-100 px-3 py-2 text-sm font-medium text-violet-600 hover:bg-violet-50"
          >
            + {t('languages.addNewLanguage')}
          </li>
        </ul>
      )}
    </div>
  )
}

function SortableLangCard({
  lang,
  onEdit,
  onDelete,
}: {
  lang: Language
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
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
        <div className="truncate font-semibold text-slate-800">
          {langName(t, lang.code, lang.name)}
        </div>
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
  const { t } = useTranslation()
  return (
    <div className="card flex cursor-grabbing items-center gap-3 p-3.5 shadow-2xl ring-2 ring-violet-400/40">
      <span className="text-lg leading-none text-violet-400">⠿</span>
      <Monogram code={lang.code} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-slate-800">
          {langName(t, lang.code, lang.name)}
        </div>
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

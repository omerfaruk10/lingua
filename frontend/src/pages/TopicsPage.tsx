import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useConfirm } from '../components/ConfirmProvider'
import { Modal } from '../components/Modal'
import { useLanguageId } from '../components/WorkspaceLayout'
import { useCreateTopic, useDeleteTopic, useTopics, useUpdateTopic } from '../hooks/useTopics'
import type { Topic, TopicStatus } from '../types'

const ALL_STATUSES: TopicStatus[] = ['not_started', 'in_progress', 'done']

const STATUS_STYLE: Record<TopicStatus, string> = {
  not_started: 'bg-slate-100 text-slate-500',
  in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-emerald-100 text-emerald-700',
}

const STATUS_HOVER: Record<TopicStatus, string> = {
  not_started: 'hover:bg-slate-100 hover:text-slate-600',
  in_progress: 'hover:bg-amber-50 hover:text-amber-700',
  done: 'hover:bg-emerald-50 hover:text-emerald-700',
}

const COLUMN_META: Record<TopicStatus, { border: string; dot: string; numBg: string; numText: string }> = {
  not_started: { border: 'border-slate-200', dot: 'bg-slate-300', numBg: 'bg-slate-100', numText: 'text-slate-400' },
  in_progress: { border: 'border-amber-200', dot: 'bg-amber-400', numBg: 'bg-amber-100', numText: 'text-amber-600' },
  done: { border: 'border-emerald-200', dot: 'bg-emerald-400', numBg: 'bg-emerald-100', numText: 'text-emerald-600' },
}

export function TopicsPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const languageId = useLanguageId()
  const { data: topics, isLoading } = useTopics(languageId)
  const createTopic = useCreateTopic(languageId)
  const updateTopic = useUpdateTopic(languageId)
  const deleteTopic = useDeleteTopic(languageId)

  const [addOpen, setAddOpen] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addDesc, setAddDesc] = useState('')

  const list = topics ?? []
  const doneCount = list.filter((x) => x.status === 'done').length

  function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim()) return
    createTopic.mutate(
      { title: addTitle.trim(), description: addDesc.trim() || null, order_index: list.length },
      {
        onSuccess: () => {
          setAddTitle('')
          setAddDesc('')
          setAddOpen(false)
        },
      },
    )
  }

  function setStatus(topicId: number, status: TopicStatus) {
    updateTopic.mutate({ topicId, data: { status } })
  }

  async function remove(topicId: number) {
    const ok = await confirm({
      message: t('topics.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (ok) deleteTopic.mutate(topicId)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        {list.length > 0 && (
          <div className="flex flex-1 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${(doneCount / list.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-medium text-slate-500">
              {t('topics.progress', { done: doneCount, total: list.length })}
            </span>
          </div>
        )}
        <button onClick={() => setAddOpen(true)} className="btn-primary shrink-0 px-3 py-2">
          + {t('topics.add')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">📚</span>
          <p className="text-slate-400">{t('topics.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {ALL_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              topics={list.filter((t) => t.status === status)}
              onSetStatus={setStatus}
              onDelete={remove}
              onReorder={(reordered) => {
                reordered.forEach((topic, pos) => {
                  if (topic.order_index !== pos)
                    updateTopic.mutate({ topicId: topic.id, data: { order_index: pos } })
                })
              }}
              t={t}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <Modal title={t('topics.addTitle')} onClose={() => setAddOpen(false)}>
          <form onSubmit={submitAdd} className="space-y-3">
            <div>
              <label className="block">
                <span className="field-label">{t('topics.titlePlaceholder')}</span>
                <input
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder={t('topics.titlePlaceholder')}
                  className="input"
                  autoFocus
                />
              </label>
            </div>
            <div>
              <label className="block">
                <span className="field-label">{t('topics.descPlaceholder')}</span>
                <input
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  placeholder={t('topics.descPlaceholder')}
                  className="input"
                />
              </label>
            </div>
            <button type="submit" disabled={createTopic.isPending} className="btn-primary w-full">
              {t('topics.add')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function KanbanColumn({
  status,
  topics,
  onSetStatus,
  onDelete,
  onReorder,
  t,
}: {
  status: TopicStatus
  topics: Topic[]
  onSetStatus: (topicId: number, status: TopicStatus) => void
  onDelete: (topicId: number) => void
  onReorder: (reordered: Topic[]) => void
  t: (key: string) => string
}) {
  const [activeId, setActiveId] = useState<number | null>(null)
  const [dragWidth, setDragWidth] = useState<number | undefined>(undefined)
  const [localItems, setLocalItems] = useState<Topic[]>(topics)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const meta = COLUMN_META[status]

  useEffect(() => {
    if (activeId !== null) return
    const incoming = new Set(topics.map((t) => t.id))
    const local = new Set(localItems.map((t) => t.id))
    const changed = topics.length !== localItems.length || topics.some((t) => !local.has(t.id)) || localItems.some((t) => !incoming.has(t.id))
    if (changed) setLocalItems(topics)
  }, [topics, activeId])

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as number
    setActiveId(id)
    const node = event.active.rect.current.translated
    if (node) setDragWidth(node.width)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = localItems.findIndex((t) => t.id === active.id)
    const newIndex = localItems.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(localItems, oldIndex, newIndex)
    setLocalItems(reordered)
    onReorder(reordered)
  }

  const activeTopic = localItems.find((t) => t.id === activeId)

  return (
    <div className={`rounded-2xl border ${meta.border} bg-white/60 p-3`}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className="text-sm font-semibold text-slate-700">{t(`status.${status}`)}</span>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {localItems.length}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={localItems.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {localItems.map((topic, index) => (
              <SortableTopicCard
                key={topic.id}
                topic={topic}
                index={index + 1}
                numBg={meta.numBg}
                numText={meta.numText}
                onSetStatus={(s) => onSetStatus(topic.id, s)}
                onDelete={() => onDelete(topic.id)}
                t={t}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeTopic && (
            <div style={{ width: dragWidth }} className="card flex gap-2 p-3 shadow-2xl ring-2 ring-violet-400/40 cursor-grabbing">
              <div className="flex w-6 shrink-0 flex-col items-center">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${COLUMN_META[activeTopic.status].numBg} ${COLUMN_META[activeTopic.status].numText}`}>
                  {localItems.findIndex((t) => t.id === activeTopic.id) + 1}
                </span>
                <div className="flex flex-1 items-center">
                  <span className="text-base leading-none text-violet-400">⠿</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 min-w-0">
                <div className={`text-sm font-medium leading-snug ${activeTopic.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {activeTopic.title}
                </div>
                {activeTopic.description && (
                  <div className="text-xs text-slate-400">{activeTopic.description}</div>
                )}
                <div className="mt-auto flex justify-end pt-1">
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[activeTopic.status]}`}>
                    {t(`status.${activeTopic.status}`)}
                  </span>
                </div>
              </div>
              <span className="btn-icon-danger invisible self-start" />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function StatusDropdown({ topic, onSetStatus, t }: { topic: Topic; onSetStatus: (s: TopicStatus) => void; t: (key: string) => string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen((v) => !v)
  }

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${STATUS_STYLE[topic.status]} hover:opacity-80`}
      >
        {t(`status.${topic.status}`)}
        <span className="opacity-60">▾</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 min-w-[140px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onSetStatus(s); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition ${STATUS_HOVER[s]} ${topic.status === s ? STATUS_STYLE[s] : 'text-slate-600'}`}
            >
              {topic.status === s && <span className="text-[10px]">✓</span>}
              <span className={topic.status === s ? '' : 'ml-4'}>{t(`status.${s}`)}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function SortableTopicCard({
  topic,
  index,
  numBg,
  numText,
  onSetStatus,
  onDelete,
  t,
}: {
  topic: Topic
  index: number
  numBg: string
  numText: string
  onSetStatus: (s: TopicStatus) => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? 'transform 500ms ease' : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`card group flex gap-2 p-3 transition-[border-color,box-shadow] ${isDragging ? 'invisible' : 'hover:border-slate-300'}`}
    >
      {/* Sol kolon: numara üstte, handle dikey ortalı */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${numBg} ${numText}`}>{index}</span>
        <div className="flex flex-1 items-center">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-base leading-none text-slate-300 hover:text-violet-500 active:cursor-grabbing"
            title="Sürükle"
          >
            ⠿
          </button>
        </div>
      </div>
      {/* İçerik */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className={`text-sm font-medium leading-snug transition ${topic.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {topic.title}
        </div>
        {topic.description && (
          <div className="text-xs text-slate-400">{topic.description}</div>
        )}
        <div className="mt-auto flex justify-end pt-1">
          <StatusDropdown topic={topic} onSetStatus={onSetStatus} t={t} />
        </div>
      </div>
      <button
        onClick={onDelete}
        className="btn-icon-danger self-start opacity-0 transition group-hover:opacity-100"
        title={t('common.delete')}
      >
        ✕
      </button>
    </li>
  )
}

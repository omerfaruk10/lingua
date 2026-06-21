import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useConfirm } from '../components/ConfirmProvider'
import { Modal } from '../components/Modal'
import { useLanguageId } from '../components/WorkspaceLayout'
import { useCreateTopic, useDeleteTopic, useTopics, useUpdateTopic } from '../hooks/useTopics'
import type { Topic, TopicStatus } from '../types'

const NEXT_STATUS: Record<TopicStatus, TopicStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'not_started',
}

const STATUS_STYLE: Record<TopicStatus, string> = {
  not_started: 'bg-slate-100 text-slate-500 hover:bg-slate-200',
  in_progress: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  done: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
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
  const [activeId, setActiveId] = useState<number | null>(null)

  const list = topics ?? []
  const doneCount = list.filter((x) => x.status === 'done').length

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

  function cycleStatus(topicId: number, current: TopicStatus) {
    updateTopic.mutate({ topicId, data: { status: NEXT_STATUS[current] } })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = list.findIndex((t) => t.id === active.id)
    const newIndex = list.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(list, oldIndex, newIndex)
    reordered.forEach((topic, pos) => {
      if (topic.order_index !== pos)
        updateTopic.mutate({ topicId: topic.id, data: { order_index: pos } })
    })
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {list.map((topic) => (
                <SortableTopicRow
                  key={topic.id}
                  topic={topic}
                  onCycleStatus={() => cycleStatus(topic.id, topic.status)}
                  onDelete={() => remove(topic.id)}
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeId != null && (() => {
              const topic = list.find((t) => t.id === activeId)
              return topic ? (
                <div className={`card flex cursor-grabbing items-center gap-3 p-3.5 shadow-2xl ring-2 ring-violet-400/40 ${STATUS_STYLE[topic.status].split(' ')[0]}`}>
                  <span className="text-lg leading-none text-violet-400">⠿</span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[topic.status]}`}>
                    {t(`status.${topic.status}`)}
                  </span>
                  <div className="flex-1 font-medium text-slate-800">{topic.title}</div>
                </div>
              ) : null
            })()}
          </DragOverlay>
        </DndContext>
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

function SortableTopicRow({
  topic,
  onCycleStatus,
  onDelete,
  t,
}: {
  topic: Topic
  onCycleStatus: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`card group flex items-center gap-3 p-3.5 transition ${isDragging ? 'opacity-40' : 'hover:border-slate-300'}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-lg leading-none text-slate-300 hover:text-violet-500 active:cursor-grabbing"
        title="Sürükle"
      >
        ⠿
      </button>

      <button
        onClick={onCycleStatus}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${STATUS_STYLE[topic.status]}`}
      >
        {t(`status.${topic.status}`)}
      </button>

      <div className="flex-1">
        <div
          className={`font-medium transition ${topic.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}`}
        >
          {topic.title}
        </div>
        {topic.description && (
          <div className="text-sm text-slate-500">{topic.description}</div>
        )}
      </div>

      <button
        onClick={onDelete}
        className="btn-icon-danger opacity-0 transition group-hover:opacity-100"
        title={t('common.delete')}
      >
        ✕
      </button>
    </li>
  )
}

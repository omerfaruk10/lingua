import { DndContext, DragOverlay, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useConfirm } from '../components/ConfirmProvider'
import { LabelBadge } from '../components/LabelBadge'
import { LABEL_PALETTE } from '../components/labelColors'
import { Modal } from '../components/Modal'
import { useLanguageId } from '../components/WorkspaceLayout'
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '../hooks/useLabels'
import type { Label } from '../types'

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`h-6 w-6 rounded-full transition ${
            value === c ? 'ring-2 ring-slate-800 ring-offset-1' : 'hover:scale-110'
          }`}
          aria-label={c}
        />
      ))}
    </div>
  )
}

export function LabelsPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const languageId = useLanguageId()
  const { data: labels, isLoading } = useLabels(languageId)
  const createLabel = useCreateLabel(languageId)
  const updateLabel = useUpdateLabel(languageId)
  const deleteLabel = useDeleteLabel(languageId)

  const [addOpen, setAddOpen] = useState(false)
  const [editingLabel, setEditingLabel] = useState<Label | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(LABEL_PALETTE[0])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [localList, setLocalList] = useState<Label[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (activeId !== null) return
    const serverList = labels ?? []
    const serverIds = new Set(serverList.map((l) => l.id))
    const localIds = new Set(localList.map((l) => l.id))
    const changed = serverList.length !== localList.length || serverList.some((l) => !localIds.has(l.id)) || localList.some((l) => !serverIds.has(l.id))
    if (changed) setLocalList(serverList)
  }, [labels, activeId])

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createLabel.mutate(
      { name: name.trim(), color },
      { onSuccess: () => { setName(''); setColor(LABEL_PALETTE[0]); setAddOpen(false) } },
    )
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLabel || !name.trim()) return
    updateLabel.mutate(
      { labelId: editingLabel.id, data: { name: name.trim(), color } },
      {
        onSuccess: (updated) => {
          setLocalList((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
          setEditingLabel(null)
        },
      },
    )
  }

  function openEdit(label: Label) {
    setEditingLabel(label)
    setName(label.name)
    setColor(label.color ?? LABEL_PALETTE[0])
  }

  async function remove(id: number) {
    const ok = await confirm({
      message: t('labels.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (ok) deleteLabel.mutate(id)
  }

  function handleDragStart(event: { active: { id: number | string } }) {
    setActiveId(event.active.id as number)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = localList.findIndex((l) => l.id === active.id)
    const newIndex = localList.findIndex((l) => l.id === over.id)
    const reordered = arrayMove(localList, oldIndex, newIndex)
    setLocalList(reordered)
    reordered.forEach((label, pos) => {
      if ((labels ?? []).findIndex((l) => l.id === label.id) !== pos)
        updateLabel.mutate({ labelId: label.id, data: { order_index: pos } })
    })
  }

  const activeLabel = localList.find((l) => l.id === activeId)

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => { setName(''); setColor(LABEL_PALETTE[0]); setAddOpen(true) }} className="btn-primary shrink-0 px-3 py-2">
          + {t('labels.add')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : localList.length === 0 ? (
        <div className="card flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">🏷️</span>
          <p className="text-slate-400">{t('labels.empty')}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={localList.map((l) => l.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-4 gap-2">
              {localList.map((label) => (
                <SortableLabelCard
                  key={label.id}
                  label={label}
                  onEdit={() => openEdit(label)}
                  onDelete={() => remove(label.id)}
                  t={t}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeLabel && (
              <div className="card flex items-center gap-2 p-3 shadow-2xl ring-2 ring-violet-400/40">
                <LabelBadge label={activeLabel} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {addOpen && (
        <Modal title={t('labels.addTitle')} onClose={() => setAddOpen(false)}>
          <form onSubmit={create} className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('labels.namePlaceholder')}
              className="input"
              autoFocus
            />
            <div>
              <span className="field-label">{t('labels.color')}</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <button type="submit" disabled={createLabel.isPending} className="btn-primary w-full">
              {t('labels.add')}
            </button>
          </form>
        </Modal>
      )}

      {editingLabel && (
        <Modal title={t('common.edit')} onClose={() => setEditingLabel(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('labels.namePlaceholder')}
              className="input"
              autoFocus
            />
            <div>
              <span className="field-label">{t('labels.color')}</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <button type="submit" disabled={updateLabel.isPending} className="btn-primary w-full">
              {t('common.save')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function SortableLabelCard({
  label,
  onEdit,
  onDelete,
  t,
}: {
  label: Label
  onEdit: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: label.id })
  const style = { transform: CSS.Transform.toString(transform), transition: transition ? 'transform 700ms ease' : undefined }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`card group flex items-center justify-between gap-2 p-3 transition-[border-color,box-shadow] ${isDragging ? 'invisible' : 'hover:border-slate-300'}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-300 hover:text-violet-500 active:cursor-grabbing"
      >
        ⠿
      </button>
      <div className="flex-1 min-w-0">
        <LabelBadge label={label} />
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={onEdit} className="btn-icon" title={t('common.edit')}>✎</button>
        <button onClick={onDelete} className="btn-icon-danger" title={t('common.delete')}>✕</button>
      </div>
    </li>
  )
}

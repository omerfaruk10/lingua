import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useConfirm } from '../components/ConfirmProvider'
import { LabelBadge } from '../components/LabelBadge'
import { LABEL_PALETTE } from '../components/labelColors'
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

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(LABEL_PALETTE[6])
  const [editingId, setEditingId] = useState<number | null>(null)

  const list = labels ?? []

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createLabel.mutate({ name: name.trim(), color }, { onSuccess: () => setName('') })
  }

  async function remove(id: number) {
    const ok = await confirm({
      message: t('labels.deleteConfirm'),
      confirmLabel: t('common.delete'),
      danger: true,
    })
    if (ok) deleteLabel.mutate(id)
  }

  return (
    <div className="space-y-5">
      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center gap-1 border-dashed bg-white/50 p-10 text-center">
          <span className="text-3xl">🏷️</span>
          <p className="text-slate-400">{t('labels.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((label) =>
            editingId === label.id ? (
              <EditRow
                key={label.id}
                label={label}
                saving={updateLabel.isPending}
                onSave={(data) =>
                  updateLabel.mutate(
                    { labelId: label.id, data },
                    { onSuccess: () => setEditingId(null) },
                  )
                }
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <li
                key={label.id}
                className="card group flex items-center justify-between p-3 transition hover:border-slate-300"
              >
                <LabelBadge label={label} />
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setEditingId(label.id)} className="btn-icon" title={t('common.edit')}>
                    ✎
                  </button>
                  <button onClick={() => remove(label.id)} className="btn-icon-danger" title={t('common.delete')}>
                    ✕
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {/* Etiket ekleme */}
      <form onSubmit={create} className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-800">{t('labels.addTitle')}</h2>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('labels.namePlaceholder')}
            className="input"
          />
          <div>
            <span className="field-label">{t('labels.color')}</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <button type="submit" disabled={createLabel.isPending} className="btn-primary mt-4">
          {t('labels.add')}
        </button>
      </form>
    </div>
  )
}

function EditRow({
  label,
  saving,
  onSave,
  onCancel,
}: {
  label: Label
  saving: boolean
  onSave: (data: { name: string; color: string }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(label.name)
  const [color, setColor] = useState(label.color ?? LABEL_PALETTE[6])

  return (
    <li className="card space-y-3 border-violet-200 p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), color })}
          disabled={saving}
          className="btn-primary px-3 py-1.5"
        >
          {t('common.save')}
        </button>
        <button onClick={onCancel} className="btn-ghost px-3 py-1.5">
          {t('common.cancel')}
        </button>
      </div>
    </li>
  )
}

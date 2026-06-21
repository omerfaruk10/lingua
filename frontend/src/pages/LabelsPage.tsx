import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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

  function remove(id: number) {
    if (confirm(t('labels.deleteConfirm'))) deleteLabel.mutate(id)
  }

  return (
    <div className="space-y-5">
      {isLoading ? (
        <p className="text-slate-400">{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-400">
          {t('labels.empty')}
        </p>
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
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <LabelBadge label={label} />
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingId(label.id)}
                    className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-violet-600"
                    title={t('common.edit')}
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => remove(label.id)}
                    className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title={t('common.delete')}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {/* Etiket ekleme */}
      <form onSubmit={create} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">{t('labels.addTitle')}</h2>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('labels.namePlaceholder')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {t('labels.color')}
            </span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <button
          type="submit"
          disabled={createLabel.isPending}
          className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
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
    <li className="space-y-3 rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button
          onClick={() => name.trim() && onSave({ name: name.trim(), color })}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {t('common.save')}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          {t('common.cancel')}
        </button>
      </div>
    </li>
  )
}

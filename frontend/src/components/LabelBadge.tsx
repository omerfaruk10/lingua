import type { Label } from '../types'
import { labelColor } from './labelColors'

export function LabelBadge({ label, onRemove }: { label: Label; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: labelColor(label.color) }}
    >
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer leading-none text-white/80 hover:text-white"
          aria-label="remove"
        >
          ×
        </button>
      )}
    </span>
  )
}

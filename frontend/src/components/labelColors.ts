// Gmail tarzi etiket renk paleti.
export const LABEL_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
]

export const DEFAULT_LABEL_COLOR = '#64748b'

export function labelColor(color: string | null | undefined): string {
  return color ?? DEFAULT_LABEL_COLOR
}

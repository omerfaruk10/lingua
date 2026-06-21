import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  title?: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="animate-overlay absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-panel relative z-10 flex max-h-full w-full flex-col ${maxWidth} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10`}
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
            <button onClick={onClose} className="btn-icon -mr-1.5" aria-label="close">
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

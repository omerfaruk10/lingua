import { useEffect, useState } from 'react'

function useDelayedVisibility(active: boolean, delay: number) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [active, delay])

  return visible
}

export function LoadingBar({ active, label, delay = 150 }: { active: boolean; label: string; delay?: number }) {
  const visible = useDelayedVisibility(active, delay)

  return (
    <div className="relative h-0" aria-live="polite">
      {active && <span className="sr-only">{label}</span>}
      {visible && (
        <div className="loading-bar-track absolute inset-x-0 top-0 z-10" role="progressbar" aria-label={label}>
          <span className="loading-bar-line" />
        </div>
      )}
    </div>
  )
}

export function LoadingState({ label, delay = 150 }: { label: string; delay?: number }) {
  return (
    <div className="relative min-h-16" aria-busy="true">
      <LoadingBar active label={label} delay={delay} />
    </div>
  )
}

export function ButtonProgress({ active, label, delay = 150 }: { active: boolean; label: string; delay?: number }) {
  const visible = useDelayedVisibility(active, delay)
  return (
    <>
      {active && <span className="sr-only">{label}</span>}
      {visible && (
        <span className="button-loading-track" role="progressbar" aria-label={label}>
          <span className="button-loading-line" />
        </span>
      )}
    </>
  )
}

import { createContext, useCallback, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from './Modal'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}

interface PendingState {
  options: ConfirmOptions
  resolve: (result: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<PendingState | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => setPending({ options, resolve }))
  }, [])

  function close(result: boolean) {
    pending?.resolve(result)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <Modal title={pending.options.title ?? t('common.confirmTitle')} onClose={() => close(false)}>
          <p className="text-slate-600">{pending.options.message}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => close(false)} className="btn-ghost">
              {pending.options.cancelLabel ?? t('common.no')}
            </button>
            <button
              onClick={() => close(true)}
              className={pending.options.danger ? 'btn-danger' : 'btn-primary'}
              autoFocus
            >
              {pending.options.confirmLabel ?? t('common.yes')}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api } from '../api/client'

export function BackendStatus() {
  const { t } = useTranslation()
  const { isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string }>('/health'),
  })

  const { dot, text } = isLoading
    ? { dot: 'bg-amber-400', text: t('backend.checking') }
    : isError
      ? { dot: 'bg-red-500', text: t('backend.offline') }
      : { dot: 'bg-emerald-500', text: t('backend.online') }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-500 backdrop-blur-sm">
      <span className="relative flex h-2 w-2">
        {!isError && !isLoading && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {text}
    </div>
  )
}

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
      : { dot: 'bg-green-500', text: t('backend.online') }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {text}
    </div>
  )
}

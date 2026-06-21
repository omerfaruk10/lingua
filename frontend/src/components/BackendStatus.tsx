import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { api } from '../api/client'

export function BackendStatus() {
  const { t } = useTranslation()
  const { isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string }>('/health'),
  })

  // Backend calisiyorken sessiz kal; sadece kapaliyken uyari goster.
  if (!isError) return null

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      {t('backend.offline')}
    </div>
  )
}

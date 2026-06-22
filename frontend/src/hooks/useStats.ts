import { useQuery } from '@tanstack/react-query'

import { statsApi } from '../api/stats'

export function useDailyStats(languageId: number) {
  return useQuery({
    queryKey: ['languages', languageId, 'stats', 'daily'],
    queryFn: () => statsApi.daily(languageId),
    enabled: languageId > 0,
  })
}

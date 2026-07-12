import { useQuery } from '@tanstack/react-query'

import { statsApi } from '../api/stats'

export function useDailyStats(languageId: number) {
  return useQuery({
    queryKey: ['languages', languageId, 'stats', 'daily'],
    queryFn: () => statsApi.daily(languageId),
    enabled: languageId > 0,
  })
}

export function useDailyActivity(languageId: number, day: string) {
  return useQuery({
    queryKey: ['languages', languageId, 'stats', 'activity', day],
    queryFn: () => statsApi.activity(languageId, day),
    enabled: languageId > 0 && Boolean(day),
  })
}

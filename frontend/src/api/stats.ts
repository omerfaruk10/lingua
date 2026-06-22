import type { DailyStat } from '../types'
import { api } from './client'

export const statsApi = {
  daily: (languageId: number) =>
    api.get<DailyStat[]>(`/languages/${languageId}/stats/daily`),
}

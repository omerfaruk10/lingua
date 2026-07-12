import type { DailyActivity, DailyStat } from '../types'
import { api } from './client'

export const statsApi = {
  daily: (languageId: number) =>
    api.get<DailyStat[]>(`/languages/${languageId}/stats/daily`),
  activity: (languageId: number, day: string) =>
    api.get<DailyActivity>(`/languages/${languageId}/stats/activity?day=${day}`),
}

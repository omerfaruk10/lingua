import type { Language } from '../types'
import { api } from './client'

export interface LanguageInput {
  code: string
  name: string
  native_name: string
}

export const languagesApi = {
  list: () => api.get<Language[]>('/languages'),
  get: (id: number) => api.get<Language>(`/languages/${id}`),
  create: (data: LanguageInput) => api.post<Language>('/languages', data),
  update: (id: number, data: Partial<LanguageInput>) => api.patch<Language>(`/languages/${id}`, data),
  remove: (id: number) => api.delete<void>(`/languages/${id}`),
}

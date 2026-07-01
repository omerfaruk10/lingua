import type { Language, LanguageBrief } from '../types'
import { api } from './client'

// Bir dile referans: mevcut katalog dili (id) ya da 'o anlik' yeni dil (code/name/native_name).
export interface LangRef {
  id?: number
  code?: string
  name?: string
  native_name?: string
}

export interface CourseInput {
  target: LangRef
  native: LangRef
  helpers: LangRef[]
}

export interface CourseUpdate {
  order_index?: number
  native?: LangRef
  helpers?: LangRef[]
}

export const languagesApi = {
  list: () => api.get<Language[]>('/languages'),
  catalog: () => api.get<LanguageBrief[]>('/languages/catalog'),
  get: (id: number) => api.get<Language>(`/languages/${id}`),
  create: (data: CourseInput) => api.post<Language>('/languages', data),
  update: (id: number, data: CourseUpdate) => api.patch<Language>(`/languages/${id}`, data),
  remove: (id: number) => api.delete<void>(`/languages/${id}`),
}

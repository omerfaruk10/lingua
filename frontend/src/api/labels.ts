import type { Label } from '../types'
import { api } from './client'

export interface LabelInput {
  name: string
  color?: string | null
}

export const labelsApi = {
  list: (languageId: number) => api.get<Label[]>(`/languages/${languageId}/labels`),
  create: (languageId: number, data: LabelInput) =>
    api.post<Label>(`/languages/${languageId}/labels`, data),
  update: (languageId: number, labelId: number, data: Partial<LabelInput>) =>
    api.patch<Label>(`/languages/${languageId}/labels/${labelId}`, data),
  remove: (languageId: number, labelId: number) =>
    api.delete<void>(`/languages/${languageId}/labels/${labelId}`),
}

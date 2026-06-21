import type { Word } from '../types'
import { api } from './client'

export interface WordInput {
  term: string
  phonetic?: string | null
  phonetic_tr?: string | null
  part_of_speech?: string | null
  meaning_native?: string | null
  meaning_english?: string | null
  definition_target?: string | null
  example_sentence?: string | null
  example_translation?: string | null
}

export interface WordQuery {
  search?: string
  label_id?: number
}

function buildQuery(q?: WordQuery): string {
  if (!q) return ''
  const params = new URLSearchParams()
  if (q.search) params.set('search', q.search)
  if (q.label_id != null) params.set('label_id', String(q.label_id))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const wordsApi = {
  list: (languageId: number, query?: WordQuery) =>
    api.get<Word[]>(`/languages/${languageId}/words${buildQuery(query)}`),
  create: (languageId: number, data: WordInput) =>
    api.post<Word>(`/languages/${languageId}/words`, data),
  update: (languageId: number, wordId: number, data: Partial<WordInput>) =>
    api.patch<Word>(`/languages/${languageId}/words/${wordId}`, data),
  remove: (languageId: number, wordId: number) =>
    api.delete<void>(`/languages/${languageId}/words/${wordId}`),
  addLabel: (languageId: number, wordId: number, labelId: number) =>
    api.post<Word>(`/languages/${languageId}/words/${wordId}/labels/${labelId}`),
  removeLabel: (languageId: number, wordId: number, labelId: number) =>
    api.delete<Word>(`/languages/${languageId}/words/${wordId}/labels/${labelId}`),
}

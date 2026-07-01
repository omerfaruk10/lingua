import type { Label, LearningStatus, Word } from '../types'
import { api } from './client'

export interface WordMeaningInput {
  language_id: number
  value: string | null
}

export interface WordInput {
  term: string
  phonetic?: string | null
  phonetic_native?: string | null
  part_of_speech?: string | null
  definition_target?: string | null
  example_sentence?: string | null
  example_translation?: string | null
  meanings?: WordMeaningInput[]
}

export interface WordImportRow extends WordInput {
  action: 'create' | 'replace'
  replace_word_id?: number
}

export interface WordImportRequest {
  rows: WordImportRow[]
  label_name?: string
  label_color?: string
}

export interface WordImportRowError {
  row: number
  message: string
}

export interface WordImportResult {
  created: number
  replaced: number
  errors: WordImportRowError[]
  label: Label | null
}

export interface WordQuery {
  search?: string
  label_id?: number
  status?: LearningStatus
}

function buildQuery(q?: WordQuery): string {
  if (!q) return ''
  const params = new URLSearchParams()
  if (q.search) params.set('search', q.search)
  if (q.label_id != null) params.set('label_id', String(q.label_id))
  if (q.status) params.set('status', q.status)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const wordsApi = {
  list: (languageId: number, query?: WordQuery) =>
    api.get<Word[]>(`/languages/${languageId}/words${buildQuery(query)}`),
  due: (languageId: number) => api.get<Word[]>(`/languages/${languageId}/words/due`),
  importBatch: (languageId: number, data: WordImportRequest) =>
    api.post<WordImportResult>(`/languages/${languageId}/words/import`, data),
  create: (languageId: number, data: WordInput) =>
    api.post<Word>(`/languages/${languageId}/words`, data),
  update: (languageId: number, wordId: number, data: Partial<WordInput>) =>
    api.patch<Word>(`/languages/${languageId}/words/${wordId}`, data),
  remove: (languageId: number, wordId: number) =>
    api.delete<void>(`/languages/${languageId}/words/${wordId}`),
  setStatus: (languageId: number, wordId: number, status: LearningStatus) =>
    api.patch<Word>(`/languages/${languageId}/words/${wordId}/status`, { status }),
  review: (languageId: number, wordId: number, result: 'known' | 'forgot') =>
    api.post<Word>(`/languages/${languageId}/words/${wordId}/review`, { result }),
  addLabel: (languageId: number, wordId: number, labelId: number) =>
    api.post<Word>(`/languages/${languageId}/words/${wordId}/labels/${labelId}`),
  removeLabel: (languageId: number, wordId: number, labelId: number) =>
    api.delete<Word>(`/languages/${languageId}/words/${wordId}/labels/${labelId}`),
}

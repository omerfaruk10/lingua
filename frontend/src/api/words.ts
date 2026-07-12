import type { Label, LearningStatus, Word, WordLevel } from '../types'
import { api } from './client'

export interface WordMeaningInput {
  language_id: number
  value: string | null
}

export interface WordInput {
  term: string
  phonetic?: string | null
  phonetic_native?: string | null
  pronunciation_note_native?: string | null
  part_of_speech?: string | null
  level?: WordLevel | null
  definition_target?: string | null
  example_sentence?: string | null
  example_translation?: string | null
  synonyms?: string | null
  antonyms?: string | null
  word_family?: string | null
  accepted_answers?: string | null
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

export interface WordSense {
  part_of_speech?: string | null
  // language_id -> anlam metni
  meanings?: Record<number, string>
}

export interface WordSuggestResponse {
  // Kelimenin en yaygin anlamlari (en fazla 5), kullanicinin secmesi icin.
  senses: WordSense[]
  model?: string | null
  source?: 'gemini' | 'cache' | string | null
}

export interface WordSuggestDetailsRequest {
  term: string
  part_of_speech?: string | null
  meaning: string
}

export interface WordSuggestDetailsResponse {
  phonetic?: string | null
  phonetic_native?: string | null
  pronunciation_note_native?: string | null
  level?: WordLevel | null
  definition_target?: string | null
  example_sentence?: string | null
  example_translation?: string | null
  synonyms?: string | null
  antonyms?: string | null
  word_family?: string | null
  model?: string | null
  source?: 'gemini' | 'cache' | string | null
}

export interface WordQuery {
  search?: string
  label_id?: number
  status?: LearningStatus
  level?: WordLevel
  part_of_speech?: string
}

function buildQuery(q?: WordQuery): string {
  if (!q) return ''
  const params = new URLSearchParams()
  if (q.search) params.set('search', q.search)
  if (q.label_id != null) params.set('label_id', String(q.label_id))
  if (q.status) params.set('status', q.status)
  if (q.level) params.set('level', q.level)
  if (q.part_of_speech) params.set('part_of_speech', q.part_of_speech)
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const wordsApi = {
  list: (languageId: number, query?: WordQuery) =>
    api.get<Word[]>(`/languages/${languageId}/words${buildQuery(query)}`),
  due: (languageId: number) => api.get<Word[]>(`/languages/${languageId}/words/due`),
  importBatch: (languageId: number, data: WordImportRequest) =>
    api.post<WordImportResult>(`/languages/${languageId}/words/import`, data),
  suggest: (languageId: number, term: string) =>
    api.post<WordSuggestResponse>(`/languages/${languageId}/words/suggest`, { term }),
  suggestDetails: (languageId: number, data: WordSuggestDetailsRequest) =>
    api.post<WordSuggestDetailsResponse>(`/languages/${languageId}/words/suggest/details`, data),
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

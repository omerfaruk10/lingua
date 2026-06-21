// Backend Pydantic semalariyla es TS tipleri.

export interface Language {
  id: number
  code: string
  name: string
  native_name: string
  order_index: number
  created_at: string
}

export type TopicStatus = 'not_started' | 'in_progress' | 'done'

export interface Topic {
  id: number
  language_id: number
  title: string
  description: string | null
  order_index: number
  status: TopicStatus
  completed_at: string | null
  created_at: string
}

export interface Label {
  id: number
  language_id: number
  name: string
  color: string | null
  order_index: number
  created_at: string
}

export interface Word {
  id: number
  language_id: number
  term: string
  phonetic: string | null
  phonetic_tr: string | null
  part_of_speech: string | null
  meaning_native: string | null
  meaning_english: string | null
  definition_target: string | null
  example_sentence: string | null
  example_translation: string | null
  labels: Label[]
  created_at: string
  updated_at: string
}

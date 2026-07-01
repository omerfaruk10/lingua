// Backend Pydantic semalariyla es TS tipleri.

export interface LanguageBrief {
  id: number
  code: string
  name: string
  native_name: string
}

// Bir kurs (ogrenme kurulumu): hedef dil + ana dil + yardimci diller.
// Ayni hedef dil icin birden fazla kurs olabilir (id ile ayirt edilir, code ile degil).
export interface Language {
  id: number
  code: string
  name: string
  native_name: string
  order_index: number
  created_at: string
  target_language: LanguageBrief
  native_language: LanguageBrief
  helper_languages: LanguageBrief[]
}

export type TopicStatus = 'not_started' | 'in_progress' | 'done'

export interface Topic {
  id: number
  course_id: number
  title: string
  description: string | null
  order_index: number
  status: TopicStatus
  completed_at: string | null
  created_at: string
}

export interface Label {
  id: number
  course_id: number
  name: string
  color: string | null
  order_index: number
  created_at: string
}

export interface DailyStat {
  day: string // YYYY-MM-DD (yerel gun)
  added: number
  reviewed: number
}

export type LearningStatus = 'new' | 'learning' | 'learned'

export interface WordMeaning {
  language_id: number
  value: string
}

export interface Word {
  id: number
  course_id: number
  term: string
  phonetic: string | null
  phonetic_native: string | null
  part_of_speech: string | null
  definition_target: string | null
  example_sentence: string | null
  example_translation: string | null
  meanings: WordMeaning[]
  labels: Label[]
  learning_status: LearningStatus
  review_stage: number
  next_review_date: string | null
  learned_at: string | null
  created_at: string
  updated_at: string
}

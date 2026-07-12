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
export type WordLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

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
  pronunciation_note_native: string | null
  part_of_speech: string | null
  level: WordLevel | null
  definition_target: string | null
  example_sentence: string | null
  example_translation: string | null
  synonyms: string | null
  antonyms: string | null
  word_family: string | null
  accepted_answers: string | null
  meanings: WordMeaning[]
  labels: Label[]
  learning_status: LearningStatus
  review_stage: number
  next_review_date: string | null
  learned_at: string | null
  created_at: string
  updated_at: string
}

export type LearningQuestionType = 'intro' | 'choice' | 'typing'
export type LearningAnswerResult = 'completed' | 'correct' | 'minor_typo' | 'incorrect'

export interface LearningOption {
  word_id: number
  term: string
}

export interface LearningTask {
  attempt_token: string
  question_type: LearningQuestionType
  word: Word
  prompt: string | null
  options: LearningOption[]
}

export interface LearningSummaryItem {
  word: Word
  mistake_count: number
}

export interface LearningSession {
  id: number
  course_id: number
  status: 'active' | 'completed' | 'cancelled'
  phase: 'practice' | 'summary' | 'terminal'
  created_at: string
  updated_at: string
  completed_at: string | null
  completed_word_ids: number[] | null
  progress: {
    completed_count: number
    cancelled_count: number
    total_count: number
  }
  current_task: LearningTask | null
  summary_items: LearningSummaryItem[]
}

export interface LearningAnswerResponse {
  result: LearningAnswerResult
  correct_term: string | null
  session: LearningSession
}

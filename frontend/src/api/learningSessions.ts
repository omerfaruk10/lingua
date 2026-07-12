import type {
  LearningAnswerResponse,
  LearningQuestionType,
  LearningSession,
} from '../types'
import { api } from './client'

export interface LearningAnswerInput {
  attempt_token: string
  question_type: LearningQuestionType
  selected_word_id?: number
  submitted_answer?: string
}

export const learningSessionsApi = {
  current: async (courseId: number): Promise<LearningSession | null> =>
    (await api.post<LearningSession | undefined>(
      `/languages/${courseId}/learning-sessions/current`,
    )) ?? null,
  answer: (courseId: number, sessionId: number, data: LearningAnswerInput) =>
    api.post<LearningAnswerResponse>(
      `/languages/${courseId}/learning-sessions/${sessionId}/answer`,
      data,
    ),
  complete: (courseId: number, sessionId: number, learnedWordIds: number[]) =>
    api.post<LearningSession>(
      `/languages/${courseId}/learning-sessions/${sessionId}/complete`,
      { learned_word_ids: learnedWordIds },
    ),
  cancel: (courseId: number, sessionId: number) =>
    api.post<{ session: LearningSession }>(
      `/languages/${courseId}/learning-sessions/${sessionId}/cancel`,
    ),
}

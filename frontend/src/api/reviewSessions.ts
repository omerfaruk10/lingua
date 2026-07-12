import type { ReviewAnswerResponse, ReviewOverview, ReviewQuestionType, ReviewSession } from '../types'
import { api } from './client'

export interface ReviewAnswerInput {
  attempt_token: string
  question_type: ReviewQuestionType
  selected_word_id?: number
  submitted_answer?: string
  skip?: boolean
}

const root = (courseId: number) => `/languages/${courseId}/review-sessions`

export const reviewSessionsApi = {
  overview: (courseId: number) => api.get<ReviewOverview>(`${root(courseId)}/overview`),
  current: async (courseId: number): Promise<ReviewSession | null> =>
    (await api.post<ReviewSession | undefined>(`${root(courseId)}/current`)) ?? null,
  answer: (courseId: number, sessionId: number, data: ReviewAnswerInput) =>
    api.post<ReviewAnswerResponse>(`${root(courseId)}/${sessionId}/answer`, data),
  openRemediation: (courseId: number, sessionId: number, itemId: number) =>
    api.post<ReviewSession>(`${root(courseId)}/${sessionId}/items/${itemId}/open-remediation`),
  decide: (courseId: number, sessionId: number, itemId: number, action: 'retry_tomorrow' | 'restart') =>
    api.post<ReviewSession>(`${root(courseId)}/${sessionId}/items/${itemId}/decision`, { action }),
  cancel: (courseId: number, sessionId: number) =>
    api.post<ReviewSession>(`${root(courseId)}/${sessionId}/cancel`),
  complete: (courseId: number, sessionId: number) =>
    api.post<ReviewSession>(`${root(courseId)}/${sessionId}/complete`),
}

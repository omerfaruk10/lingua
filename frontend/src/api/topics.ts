import type { Topic, TopicStatus } from '../types'
import { api } from './client'

export interface TopicInput {
  title: string
  description?: string | null
  order_index?: number
  status?: TopicStatus
}

export const topicsApi = {
  list: (languageId: number) => api.get<Topic[]>(`/languages/${languageId}/topics`),
  create: (languageId: number, data: TopicInput) =>
    api.post<Topic>(`/languages/${languageId}/topics`, data),
  update: (languageId: number, topicId: number, data: Partial<TopicInput>) =>
    api.patch<Topic>(`/languages/${languageId}/topics/${topicId}`, data),
  remove: (languageId: number, topicId: number) =>
    api.delete<void>(`/languages/${languageId}/topics/${topicId}`),
}

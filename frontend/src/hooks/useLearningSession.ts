import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  learningSessionsApi,
  type LearningAnswerInput,
} from '../api/learningSessions'
import type { LearningSession } from '../types'

function key(courseId: number) {
  return ['languages', courseId, 'learning-session'] as const
}

export function useLearningSession(courseId: number) {
  return useQuery({
    queryKey: key(courseId),
    queryFn: () => learningSessionsApi.current(courseId),
    enabled: courseId > 0,
  })
}

export function useAnswerLearningSession(courseId: number) {
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: number; data: LearningAnswerInput }) =>
      learningSessionsApi.answer(courseId, sessionId, data),
  })
}

export function useCompleteLearningSession(courseId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, wordIds }: { sessionId: number; wordIds: number[] }) =>
      learningSessionsApi.complete(courseId, sessionId, wordIds),
    onSuccess: (session) => {
      qc.setQueryData<LearningSession>(key(courseId), session)
      qc.invalidateQueries({ queryKey: ['languages', courseId, 'words'] })
    },
  })
}

export function useCancelLearningSession(courseId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: number) => learningSessionsApi.cancel(courseId, sessionId),
    onSuccess: ({ session }) => qc.setQueryData(key(courseId), session),
  })
}

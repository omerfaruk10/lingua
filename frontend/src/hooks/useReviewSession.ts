import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewSessionsApi, type ReviewAnswerInput } from '../api/reviewSessions'

const key = (courseId: number) => ['languages', courseId, 'review-overview'] as const

export function useReviewOverview(courseId: number) {
  return useQuery({ queryKey: key(courseId), queryFn: () => reviewSessionsApi.overview(courseId), enabled: courseId > 0 })
}

export function useReviewActions(courseId: number) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key(courseId) })
    qc.invalidateQueries({ queryKey: ['languages', courseId, 'words'] })
    qc.invalidateQueries({ queryKey: ['languages', courseId, 'stats'] })
  }
  return {
    start: useMutation({ mutationFn: () => reviewSessionsApi.current(courseId), onSuccess: refresh }),
    answer: useMutation({ mutationFn: ({ sessionId, data }: { sessionId: number; data: ReviewAnswerInput }) => reviewSessionsApi.answer(courseId, sessionId, data), onSuccess: refresh }),
    open: useMutation({ mutationFn: ({ sessionId, itemId }: { sessionId: number; itemId: number }) => reviewSessionsApi.openRemediation(courseId, sessionId, itemId), onSuccess: refresh }),
    decide: useMutation({ mutationFn: ({ sessionId, itemId, action }: { sessionId: number; itemId: number; action: 'retry_tomorrow' | 'restart' }) => reviewSessionsApi.decide(courseId, sessionId, itemId, action), onSuccess: refresh }),
    cancel: useMutation({ mutationFn: (sessionId: number) => reviewSessionsApi.cancel(courseId, sessionId), onSuccess: refresh }),
    complete: useMutation({ mutationFn: (sessionId: number) => reviewSessionsApi.complete(courseId, sessionId), onSuccess: refresh }),
  }
}

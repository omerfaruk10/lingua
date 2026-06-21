import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { topicsApi, type TopicInput } from '../api/topics'

function key(languageId: number) {
  return ['languages', languageId, 'topics'] as const
}

export function useTopics(languageId: number) {
  return useQuery({
    queryKey: key(languageId),
    queryFn: () => topicsApi.list(languageId),
    enabled: languageId > 0,
  })
}

export function useCreateTopic(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TopicInput) => topicsApi.create(languageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(languageId) }),
  })
}

export function useUpdateTopic(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ topicId, data }: { topicId: number; data: Partial<TopicInput> }) =>
      topicsApi.update(languageId, topicId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(languageId) }),
  })
}

export function useDeleteTopic(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (topicId: number) => topicsApi.remove(languageId, topicId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(languageId) }),
  })
}

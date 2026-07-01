import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { wordsApi, type WordImportRequest, type WordInput, type WordQuery } from '../api/words'
import type { LearningStatus } from '../types'

function base(languageId: number) {
  return ['languages', languageId, 'words'] as const
}

export function useWords(languageId: number, query?: WordQuery) {
  return useQuery({
    queryKey: [...base(languageId), query ?? {}],
    queryFn: () => wordsApi.list(languageId, query),
    enabled: languageId > 0,
  })
}

export function useDueWords(languageId: number) {
  return useQuery({
    queryKey: [...base(languageId), 'due'],
    queryFn: () => wordsApi.due(languageId),
    enabled: languageId > 0,
  })
}

export function useSetWordStatus(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ wordId, status }: { wordId: number; status: LearningStatus }) =>
      wordsApi.setStatus(languageId, wordId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

export function useReviewWord(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ wordId, result }: { wordId: number; result: 'known' | 'forgot' }) =>
      wordsApi.review(languageId, wordId, result),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

export function useCreateWord(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WordInput) => wordsApi.create(languageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

export function useImportWords(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WordImportRequest) => wordsApi.importBatch(languageId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: base(languageId) })
      // Import yeni bir etiket olusturmus olabilir.
      qc.invalidateQueries({ queryKey: ['languages', languageId, 'labels'] })
    },
  })
}

export function useUpdateWord(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ wordId, data }: { wordId: number; data: Partial<WordInput> }) =>
      wordsApi.update(languageId, wordId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

export function useDeleteWord(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (wordId: number) => wordsApi.remove(languageId, wordId),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

export function useAddWordLabel(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ wordId, labelId }: { wordId: number; labelId: number }) =>
      wordsApi.addLabel(languageId, wordId, labelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

export function useRemoveWordLabel(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ wordId, labelId }: { wordId: number; labelId: number }) =>
      wordsApi.removeLabel(languageId, wordId, labelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { wordsApi, type WordInput, type WordQuery } from '../api/words'

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

export function useCreateWord(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: WordInput) => wordsApi.create(languageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: base(languageId) }),
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

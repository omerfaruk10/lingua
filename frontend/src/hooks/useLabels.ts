import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { labelsApi, type LabelInput } from '../api/labels'

function key(languageId: number) {
  return ['languages', languageId, 'labels'] as const
}

export function useLabels(languageId: number) {
  return useQuery({
    queryKey: key(languageId),
    queryFn: () => labelsApi.list(languageId),
    enabled: languageId > 0,
  })
}

export function useCreateLabel(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LabelInput) => labelsApi.create(languageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(languageId) }),
  })
}

export function useUpdateLabel(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ labelId, data }: { labelId: number; data: Partial<LabelInput> }) =>
      labelsApi.update(languageId, labelId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(languageId) }),
  })
}

export function useDeleteLabel(languageId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (labelId: number) => labelsApi.remove(languageId, labelId),
    onSuccess: () => {
      // Etiket silinince kelimelerin de etiketleri degisir -> ikisini de tazele
      qc.invalidateQueries({ queryKey: key(languageId) })
      qc.invalidateQueries({ queryKey: ['languages', languageId, 'words'] })
    },
  })
}

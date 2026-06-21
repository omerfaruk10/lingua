import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { languagesApi, type LanguageInput, type LanguageUpdate } from '../api/languages'

const KEY = ['languages']

export function useLanguages() {
  return useQuery({ queryKey: KEY, queryFn: languagesApi.list })
}

export function useLanguage(id: number) {
  return useQuery({
    queryKey: ['languages', id],
    queryFn: () => languagesApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  })
}

export function useCreateLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: LanguageInput) => languagesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: LanguageUpdate }) =>
      languagesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => languagesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

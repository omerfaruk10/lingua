import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { languagesApi, type CourseInput, type CourseUpdate } from '../api/languages'

const KEY = ['languages']

export function useLanguages() {
  return useQuery({ queryKey: KEY, queryFn: languagesApi.list })
}

export function useCatalog() {
  return useQuery({ queryKey: ['languages', 'catalog'], queryFn: languagesApi.catalog })
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
    mutationFn: (data: CourseInput) => languagesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateLanguage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CourseUpdate }) =>
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

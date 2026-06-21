// Son secilen dilin id'sini hatirlar (uygulama acilista oraya doner).
const KEY = 'lingua.languageId'

export function getSelectedLanguageId(): number | null {
  const v = localStorage.getItem(KEY)
  return v ? Number(v) : null
}

export function setSelectedLanguageId(id: number): void {
  localStorage.setItem(KEY, String(id))
}

export function clearSelectedLanguageId(): void {
  localStorage.removeItem(KEY)
}

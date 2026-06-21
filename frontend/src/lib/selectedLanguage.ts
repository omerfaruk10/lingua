// Son secilen dilin kodunu hatirlar (uygulama acilista oraya doner).
const KEY = 'lingua.langCode'

export function getSelectedLangCode(): string | null {
  return localStorage.getItem(KEY)
}

export function setSelectedLangCode(code: string): void {
  localStorage.setItem(KEY, code)
}

export function clearSelectedLangCode(): void {
  localStorage.removeItem(KEY)
}

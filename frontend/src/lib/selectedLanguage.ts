// Son secilen kursun slug'ini hatirlar (uygulama acilista oraya doner).
// Slug = hedef-ana[-yardimci...] kod sirasi (orn. "it-tr-en") -- bkz. courseSlug.ts.
const KEY = 'lingua.courseSlug'

export function getSelectedCourseSlug(): string | null {
  return localStorage.getItem(KEY)
}

export function setSelectedCourseSlug(slug: string): void {
  localStorage.setItem(KEY, slug)
}

export function clearSelectedCourseSlug(): void {
  localStorage.removeItem(KEY)
}

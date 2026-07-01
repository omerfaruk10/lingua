import type { Language } from '../types'

// URL/localStorage anahtari: hedef-ana[-yardimci...] kod sirasi, orn. "it-tr" / "it-tr-en".
// Backend ayni hedef+ana+yardimci kombinasyonuyla iki kurs olusturulmasina izin
// vermez (bkz. crud/course.py), bu yuzden slug her zaman tekildir.
export function courseSlug(course: Language): string {
  const parts = [
    course.target_language.code,
    course.native_language.code,
    ...course.helper_languages.map((h) => h.code),
  ]
  return parts.join('-')
}

export function findCourseBySlug(courses: Language[], slug: string | undefined): Language | undefined {
  if (!slug) return undefined
  return courses.find((c) => courseSlug(c) === slug)
}

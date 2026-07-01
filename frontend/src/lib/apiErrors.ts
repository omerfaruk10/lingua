import type { TFunction } from 'i18next'

// Backend'in sabit (Ingilizce) hata mesajlarini bilinen UI dillerine cevirir.
// Yeni bir CourseError eklenirse hem burada hem i18n dosyalarinda errors.* altina
// karsiligi eklenmeli; eslesmeyen mesajlar oldugu gibi (Ingilizce) gosterilir.
const KNOWN_PATTERNS: { test: RegExp; key: string }[] = [
  {
    test: /^A course with this exact target\/native\/helper combination already exists$/,
    key: 'errors.duplicateCourse',
  },
  {
    test: /^Target and native language cannot be the same$/,
    key: 'errors.targetEqualsNative',
  },
  { test: /^Course not found$/, key: 'errors.courseNotFound' },
  { test: /^Language id \d+ not found$/, key: 'errors.languageNotFound' },
  { test: /^Term is empty$/, key: 'errors.importTermEmpty' },
  { test: /^replace_word_id is required for replace$/, key: 'errors.importMissingReplaceId' },
  { test: /^Word to replace not found$/, key: 'errors.importReplaceWordNotFound' },
]

export function translateApiError(t: TFunction, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const match = KNOWN_PATTERNS.find((p) => p.test.test(message))
  return match ? t(match.key) : message
}

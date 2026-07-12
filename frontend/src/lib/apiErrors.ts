import type { TFunction } from 'i18next'
import { ApiError } from '../api/client'

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

const CODE_KEYS: Record<string, string> = {
  SESSION_NOT_FOUND: 'errors.learningSessionNotFound',
  SESSION_NOT_ACTIVE: 'errors.learningSessionNotActive',
  SESSION_NOT_READY: 'errors.learningSessionNotReady',
  SESSION_ALREADY_COMPLETED: 'errors.learningSessionCompleted',
  STALE_ATTEMPT: 'errors.learningStaleAttempt',
  TOKEN_REUSED: 'errors.learningTokenReused',
  INVALID_OPTION: 'errors.learningInvalidOption',
  WORD_NOT_ELIGIBLE: 'errors.learningWordNotEligible',
}

export function translateApiError(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && error.code && CODE_KEYS[error.code]) {
    return t(CODE_KEYS[error.code])
  }
  const message = error instanceof Error ? error.message : String(error)
  const match = KNOWN_PATTERNS.find((p) => p.test.test(message))
  return match ? t(match.key) : message
}

import type { TFunction } from 'i18next'

import { langName } from './langName'
import type { LanguageBrief } from '../types'

export interface WordCsvSchema {
  headers: string[]
  meaningLangs: LanguageBrief[]
}

// Export basliklarini uretir; import ise ayni sutun duzenini pozisyona gore okur
// (bkz. wordCsvImport.ts) — ikisi meaningLangs sirasini (anadil + yardimci diller) paylasir.
export function buildWordCsvSchema(
  t: TFunction,
  nativeLang: LanguageBrief | null,
  helperLangs: LanguageBrief[],
  targetLang: LanguageBrief | null = null,
): WordCsvSchema {
  const meaningLangs: LanguageBrief[] = nativeLang ? [nativeLang, ...helperLangs] : []
  const nativeDisplay = nativeLang ? langName(t, nativeLang.code, nativeLang.native_name) : ''
  const targetDisplay = targetLang ? langName(t, targetLang.code, targetLang.native_name) : ''
  const f = (k: string) => t(`words.fields.${k}`)

  const meaningHeaders = meaningLangs.map((lang, i) =>
    i === 0 ? t('words.meaningIn', { lang: nativeDisplay }) : langName(t, lang.code, lang.name),
  )

  const headerTerm = f('term')
  const headerPos = f('part_of_speech')
  const headerPhonetic = f('phonetic')
  const headerReading = t('words.readingIn', { lang: nativeDisplay })
  const headerDefinition = t('words.definitionIn', { lang: targetDisplay })
  const headerExample = f('example_sentence')
  const headerTranslation = t('words.translationIn', { lang: nativeDisplay })

  // Sabit 8+H sutunlu duzen (bkz. wordCsvImport.ts). Etiket/durum bilerek yazilmaz:
  // import son 3 sutunu tanim/ornek/ceviri sayar, fazladan sutun bu hizayi bozardi.
  const headers = [
    headerTerm, headerPos, headerPhonetic, headerReading,
    ...meaningHeaders, headerDefinition, headerExample, headerTranslation,
  ]

  return { headers, meaningLangs }
}

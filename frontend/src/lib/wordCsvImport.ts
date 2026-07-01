import type { TFunction } from 'i18next'

import type { WordInput } from '../api/words'
import { SUPPORTED_LANGS } from '../i18n'
import { parseCsv } from './csv'
import type { WordCsvSchema } from './wordCsvSchema'

const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb', 'pronoun',
  'preposition', 'conjunction', 'interjection', 'article', 'numeral',
] as const

// LLM ciktilarindaki suslemeleri temizler: "Verb (Fiil)" -> "Verb", "Preposition / Adverb (...)" -> "Preposition".
function cleanPosText(raw: string): string {
  const noParens = raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const firstSegment = noParens.split('/')[0]
  return firstSegment.trim().toLowerCase()
}

export interface ParsedWordRow {
  row: number // 1-tabanli, baslik haric veri satiri sirasi (hata mesajlarinda kullanilir)
  data: WordInput
}

export interface ParseWordsCsvResult {
  rows: ParsedWordRow[]
  errors: { row: number; message: string }[]
  fatalError?: string
}

// Sabit sutun duzeni (baslik satiri icerigine bakilmaksizin atlanir):
// 0: kelime, 1: tur, 2: okunus, 3: anadil okunusu, 4: anadil anlami,
// 5..5+H-1: yardimci dil anlamlari (kurs sirasiyla), son 3: tanim, ornek cumle, ceviri.
const FIXED_COLS = 8 // yardimci dil sutunu olmadan minimum sutun sayisi

export function parseWordsCsv(text: string, schema: WordCsvSchema, t: TFunction): ParseWordsCsvResult {
  const table = parseCsv(text)
  if (table.length === 0) {
    return { rows: [], errors: [], fatalError: t('words.importErrorEmpty') }
  }

  const [, ...dataRows] = table // ilk satir basliktir, icerigine bakilmaksizin atlanir

  // Cevrilmis tur etiketi -> backend'in bekledigi ham anahtar (orn. "İsim" -> "noun").
  // Aktif arayuz dili ne olursa olsun, dosya hangi dilde yazilmis olursa olsun eslessin diye
  // TUM desteklenen dillerin cevirileri taranir (i18next 'lng' override'i ile).
  const posReverse = new Map<string, string>()
  for (const key of PARTS_OF_SPEECH) {
    posReverse.set(key, key)
    for (const lang of SUPPORTED_LANGS) {
      posReverse.set(t(`words.partsOfSpeech.${key}`, { lng: lang }).trim().toLowerCase(), key)
    }
  }

  const nativeLang = schema.meaningLangs[0]
  const courseHelperLangs = schema.meaningLangs.slice(1)

  const rows: ParsedWordRow[] = []
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i]
    const rowNum = i + 1
    if (cells.every((c) => c.trim() === '')) continue // tamamen bos satir: sessizce atla

    if (cells.length < FIXED_COLS) {
      // Muhtemelen sadece bos kalan sondaki hucreler kaldirilmis (virgul eksik): tum dosyayi
      // iptal etmek yerine sadece bu satiri atla, digerlerini islemeye devam et.
      errors.push({ row: rowNum, message: t('words.importErrorTooFewColumns') })
      continue
    }

    const term = (cells[0] ?? '').trim()
    if (!term) {
      errors.push({ row: rowNum, message: t('words.importErrorBlankTerm') })
      continue
    }

    const data: WordInput = { term, meanings: [] }

    const pos = (cells[1] ?? '').trim()
    if (pos) data.part_of_speech = posReverse.get(cleanPosText(pos)) ?? pos

    const phonetic = (cells[2] ?? '').trim()
    if (phonetic) data.phonetic = phonetic

    const phoneticNative = (cells[3] ?? '').trim()
    if (phoneticNative) data.phonetic_native = phoneticNative

    const nativeMeaning = (cells[4] ?? '').trim()
    if (nativeMeaning && nativeLang) {
      data.meanings!.push({ language_id: nativeLang.id, value: nativeMeaning })
    }

    // Dosyadaki yardimci dil sutun sayisi kurstakiyle uyusmayabilir: eksikse bos birak,
    // fazlaysa fazlasini yoksay (bkz. plan: kurs sirasindaki ilk N yardimci dil doldurulur).
    const fileHelperCols = cells.length - FIXED_COLS
    const helperColsToRead = Math.min(fileHelperCols, courseHelperLangs.length)
    for (let j = 0; j < helperColsToRead; j++) {
      const raw = (cells[5 + j] ?? '').trim()
      if (raw) data.meanings!.push({ language_id: courseHelperLangs[j].id, value: raw })
    }

    const tailStart = cells.length - 3
    const definition = (cells[tailStart] ?? '').trim()
    if (definition) data.definition_target = definition
    const example = (cells[tailStart + 1] ?? '').trim()
    if (example) data.example_sentence = example
    const translation = (cells[tailStart + 2] ?? '').trim()
    if (translation) data.example_translation = translation

    rows.push({ row: rowNum, data })
  }

  return { rows, errors }
}

import { useTranslation } from 'react-i18next'

import type { Word } from '../types'
import { SpeakButton } from './SpeakButton'

// Anlamlari kurs dil sirasina gore dizer (ana dil once, sonra yardimcilar).
export function orderMeanings(word: Word, meaningOrder: number[]): string[] {
  const byId = new Map(word.meanings.map((m) => [m.language_id, m.value]))
  return meaningOrder
    .map((id) => byId.get(id))
    .filter((v): v is string => !!v && v.trim().length > 0)
}

// Kelime kartinin govdesi: Review (flashcard) ve Learn (tanitim) modlarinin ortak gorunumu.
// revealed=false iken sadece terim+tur+okunus; true iken anlamlar/tanim/ornek de gorunur.
export function WordCardContent({
  word,
  orderedMeanings,
  revealed,
  langCode,
}: {
  word: Word
  orderedMeanings: string[]
  revealed: boolean
  // Hedef dilin kodu (orn. 'it'): verilirse terim yaninda seslendirme butonu cikar.
  langCode?: string
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-3xl font-semibold text-slate-900">{word.term}</span>
        {langCode && <SpeakButton text={word.term} langCode={langCode} />}
        {word.part_of_speech && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            {t(`words.partsOfSpeech.${word.part_of_speech}`, { defaultValue: word.part_of_speech })}
          </span>
        )}
      </div>
      {(word.phonetic || word.phonetic_native) && (
        <div className="mt-1.5 text-sm text-slate-400">
          {[word.phonetic, word.phonetic_native].filter(Boolean).join(' · ')}
        </div>
      )}

      {revealed && (
        <div className="mt-5 w-full space-y-2 border-t border-slate-100 pt-5">
          {orderedMeanings.length > 0 && (
            <div className="text-lg text-slate-800">
              {orderedMeanings[0]}
              {orderedMeanings.length > 1 && (
                <span className="text-slate-400"> · {orderedMeanings.slice(1).join(' · ')}</span>
              )}
            </div>
          )}
          {word.definition_target && (
            <div className="text-sm italic text-slate-500">{word.definition_target}</div>
          )}
          {(word.synonyms || word.antonyms) && (
            <div className="mx-auto mt-3 max-w-md flex flex-wrap gap-4 text-xs text-left justify-center">
              {word.synonyms && (
                <div className="flex-1 min-w-[120px]">
                  <span className="block font-medium text-slate-500 mb-0.5">{t('words.fields.synonyms')}</span>
                  <span className="text-slate-700">{word.synonyms}</span>
                </div>
              )}
              {word.antonyms && (
                <div className="flex-1 min-w-[120px]">
                  <span className="block font-medium text-slate-500 mb-0.5">{t('words.fields.antonyms')}</span>
                  <span className="text-slate-700">{word.antonyms}</span>
                </div>
              )}
            </div>
          )}

          {word.word_family && (
            <div className="mx-auto mt-3 max-w-md border-t border-slate-100 pt-3 text-left text-xs">
              <span className="block font-medium text-slate-500 mb-1">{t('words.fields.wordFamily')}</span>
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-2 rounded">
                {word.word_family}
              </div>
            </div>
          )}

          {word.example_sentence && (
            <div className="mx-auto mt-2 max-w-md border-l-2 border-slate-200 pl-3 text-left text-sm">
              <div className="text-slate-700">{word.example_sentence}</div>
              {word.example_translation && (
                <div className="text-slate-400">{word.example_translation}</div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

import { useTranslation } from 'react-i18next'

import { langName } from '../lib/langName'
import type { LanguageBrief, Word } from '../types'
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
function WordCardContentLegacy({
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
        {word.level && (
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
            {word.level}
          </span>
        )}
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
          {word.pronunciation_note_native && (
            <div className="mx-auto max-w-md rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left text-sm leading-relaxed text-slate-600">
              <span className="mb-0.5 block text-xs font-medium text-slate-500">
                {t('words.fields.pronunciationNote')}
              </span>
              {word.pronunciation_note_native}
            </div>
          )}
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
            <div className="mx-auto mt-3 max-w-md grid gap-2 text-xs text-left sm:grid-cols-2">
              {word.synonyms && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <span className="block font-medium text-slate-500 mb-0.5">{t('words.fields.synonyms')}</span>
                  <span className="text-slate-700">{word.synonyms}</span>
                </div>
              )}
              {word.antonyms && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
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
            <div className="mx-auto max-w-md border-t border-slate-100 pt-3 text-left">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t('words.fields.example_sentence')}
              </span>
              <div className="border-l-2 border-slate-200 pl-3 text-sm">
                <div className="text-slate-700">{word.example_sentence}</div>
                {word.example_translation && (
                  <div className="text-slate-400">{word.example_translation}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

void WordCardContentLegacy

export function WordCardContent({
  word,
  orderedMeanings,
  revealed,
  langCode,
  meaningLangs,
  targetLang,
}: {
  word: Word
  orderedMeanings: string[]
  revealed: boolean
  langCode?: string
  meaningLangs?: LanguageBrief[]
  targetLang?: LanguageBrief
}) {
  const { t } = useTranslation()
  const meaningById = new Map(word.meanings.map((m) => [m.language_id, m.value]))
  const labeledMeanings = (meaningLangs ?? [])
    .map((lang) => ({ lang, value: meaningById.get(lang.id) }))
    .filter((item): item is { lang: LanguageBrief; value: string } => !!item.value && item.value.trim().length > 0)
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-3xl font-semibold text-slate-900">{word.term}</span>
        {langCode && <SpeakButton text={word.term} langCode={langCode} />}
        {word.level && (
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
            {word.level}
          </span>
        )}
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
        <div className="mt-5 w-full space-y-3 border-t border-slate-100 pt-5">
          {word.pronunciation_note_native && (
            <div className="mx-auto max-w-md border-t border-slate-100 pt-3 text-left first:border-t-0 first:pt-0">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t('words.fields.pronunciationNote')}
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                {word.pronunciation_note_native}
              </div>
            </div>
          )}

          {(labeledMeanings.length > 0 || orderedMeanings.length > 0 || word.definition_target) && (
            <div className="mx-auto max-w-md border-t border-slate-100 pt-3 text-left first:border-t-0 first:pt-0">
              {labeledMeanings.length > 0 ? (
                <div className="space-y-2">
                  {labeledMeanings.map(({ lang, value }) => (
                    <div key={lang.id}>
                      <span className="mb-1 block text-xs font-medium text-slate-500">
                        {t('words.meaningIn', { lang: langName(t, lang.code, lang.native_name || lang.name) })}
                      </span>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              ) : orderedMeanings.length > 0 ? (
                <>
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    {t('words.fields.meaning')}
                  </span>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {orderedMeanings.join(' · ')}
                  </div>
                </>
              ) : null}
              {word.definition_target && (
                <div className={labeledMeanings.length > 0 || orderedMeanings.length > 0 ? 'mt-2' : ''}>
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    {targetLang
                      ? t('words.definitionIn', { lang: langName(t, targetLang.code, targetLang.native_name || targetLang.name) })
                      : t('words.fields.definition')}
                  </span>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {word.definition_target}
                  </div>
                </div>
              )}
            </div>
          )}

          {(word.synonyms || word.antonyms) && (
            <div className="mx-auto max-w-md border-t border-slate-100 pt-3">
              <div className="grid gap-2 text-left text-xs sm:grid-cols-2">
                {word.synonyms && (
                  <div>
                    <span className="mb-1 block font-medium text-slate-500">{t('words.fields.synonyms')}</span>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-700">
                      {word.synonyms}
                    </div>
                  </div>
                )}
                {word.antonyms && (
                  <div>
                    <span className="mb-1 block font-medium text-slate-500">{t('words.fields.antonyms')}</span>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-700">
                      {word.antonyms}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {word.word_family && (
            <div className="mx-auto max-w-md border-t border-slate-100 pt-3 text-left text-xs">
              <span className="block font-medium text-slate-500 mb-1">{t('words.fields.wordFamily')}</span>
              <div className="text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-2 rounded">
                {word.word_family}
              </div>
            </div>
          )}

          {word.example_sentence && (
            <div className="mx-auto max-w-md border-t border-slate-100 pt-3 text-left">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                {t('words.fields.example_sentence')}
              </span>
              <div className="border-l-2 border-slate-200 pl-3 text-sm">
                <div className="text-slate-700">{word.example_sentence}</div>
                {word.example_translation && (
                  <div className="text-slate-400">{word.example_translation}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import it from './it.json'
import tr from './tr.json'

export const SUPPORTED_LANGS = ['en', 'tr', 'it', 'es', 'de', 'fr'] as const
export type UiLang = (typeof SUPPORTED_LANGS)[number]

const STORAGE_KEY = 'lingua.uiLang'

function initialLang(): UiLang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return SUPPORTED_LANGS.includes(saved as UiLang) ? (saved as UiLang) : 'en' // varsayilan EN
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
    it: { translation: it },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setUiLang(lang: UiLang) {
  localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export default i18n

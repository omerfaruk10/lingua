import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import tr from './tr.json'

export const SUPPORTED_LANGS = ['en', 'tr'] as const
export type UiLang = (typeof SUPPORTED_LANGS)[number]

const STORAGE_KEY = 'lingua.uiLang'

function initialLang(): UiLang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'tr' || saved === 'en' ? saved : 'en' // varsayilan EN
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
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

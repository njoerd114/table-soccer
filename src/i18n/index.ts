import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import de from './de.json'
import en from './en.json'

export const supportedLanguages = ['en', 'de'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de }
    },
    supportedLngs: supportedLanguages,
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'language'
    },
    interpolation: {
      escapeValue: false
    }
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
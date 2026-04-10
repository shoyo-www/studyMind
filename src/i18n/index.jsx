// src/i18n/index.jsx
// Language context — wrap your app with <LanguageProvider>
// Use the useT() hook anywhere to get translations

import { createContext, useContext, useState, useCallback } from 'react'
import en from './en.js'
import hi from './hi.js'

const TRANSLATIONS = { en, hi }
const STORAGE_KEY  = 'preppal_lang'

// ── Context ───────────────────────────────────────────────────────────
const LangContext = createContext(null)

function getSavedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en'
  } catch {
    return 'en'
  }
}

// ── Provider ──────────────────────────────────────────────────────────
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getSavedLanguage)

  function setLang(newLang) {
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      // Ignore storage failures and keep language only in memory.
    }
    setLangState(newLang)
    if (typeof document !== 'undefined') {
      // Switch font for Hindi (Noto Sans Devanagari looks great)
      document.documentElement.setAttribute('data-lang', newLang)
    }
  }

  // t('dashboard.greeting') → 'Good morning' or 'सुप्रभात'
  // t('dashboard.tasksToday', { count: 3 }) → 'You have 3 topics...'
  const t = useCallback((key, vars = {}) => {
    const keys  = key.split('.')
    let   value = TRANSLATIONS[lang]

    for (const k of keys) {
      value = value?.[k]
      if (value === undefined) {
        // Fallback to English if key missing in translation
        let fallback = TRANSLATIONS['en']
        for (const fk of keys) fallback = fallback?.[fk]
        value = fallback || key
        break
      }
    }

    if (typeof value !== 'string') return key

    // Replace {{variable}} placeholders
    return Object.entries(vars).reduce(
      (str, [k, v]) => str.replace(new RegExp(`{{${k}}}`, 'g'), v),
      value
    )
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, t, isHindi: lang === 'hi' }}>
      {children}
    </LangContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────
export function useT() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useT must be used inside <LanguageProvider>')
  return ctx
}

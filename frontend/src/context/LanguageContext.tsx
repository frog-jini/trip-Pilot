// 선택한 언어를 앱 전역에 제공하는 Provider. AuthProvider와 같은 구조 — localStorage에서 초기값을
// 읽고, 변경 시 localStorage에 다시 써서 새로고침 후에도 유지한다.
import { useState, type ReactNode } from 'react'
import { LanguageContext } from './languageContextValue'
import { translate } from '../lib/i18n/translations'
import { readStoredLanguage, writeStoredLanguage } from '../lib/i18n/languageStorage'
import type { Language } from '../lib/i18n/language'

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage() ?? 'ko')

  function setLanguage(next: Language) {
    writeStoredLanguage(next)
    setLanguageState(next)
  }

  function t(key: string, params?: Record<string, string | number>): string {
    return translate(language, key, params)
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

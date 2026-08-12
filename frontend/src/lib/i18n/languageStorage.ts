// 선택한 언어를 localStorage에 남겨두는 곳. authStorage.ts와 같은 패턴 — 값 하나만 저장/조회한다.
import { SUPPORTED_LANGUAGES, type Language } from './language'

const LANGUAGE_KEY = 'trippilot_language'

function isLanguage(value: string | null): value is Language {
  return value !== null && (SUPPORTED_LANGUAGES as string[]).includes(value)
}

export function readStoredLanguage(): Language | null {
  const raw = localStorage.getItem(LANGUAGE_KEY)
  return isLanguage(raw) ? raw : null
}

export function writeStoredLanguage(language: Language): void {
  localStorage.setItem(LANGUAGE_KEY, language)
}

export function clearStoredLanguage(): void {
  localStorage.removeItem(LANGUAGE_KEY)
}

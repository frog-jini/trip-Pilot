// LanguageContext.tsx(Provider 구현)와 이 파일(Context 객체 + useLanguage 훅)을 분리한 이유는
// authContextValue.ts와 동일하다(타입만 가볍게 import, Fast Refresh 이슈 회피).
//
// AuthContext와 달리 기본값을 undefined가 아니라 "한국어로 동작하는 실제 값"으로 둔다 — 그래야
// LanguageProvider로 감싸지 않은 기존 컴포넌트/테스트도 항상 지금까지와 같은 한국어로 렌더링되고,
// 이 기능을 위해 기존 테스트 파일들을 건드릴 필요가 없다.
import { createContext, useContext } from 'react'
import type { Language } from '../lib/i18n/language'
import { translate } from '../lib/i18n/translations'

export interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'ko',
  setLanguage: () => {},
  t: (key: string, params?: Record<string, string | number>) => translate('ko', key, params),
})

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}

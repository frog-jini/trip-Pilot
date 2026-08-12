// 지원 언어 목록과 타입. LanguageSwitcher(표시 순서)와 languageStorage(유효성 검사) 양쪽에서 쓴다.
export type Language = 'ko' | 'en' | 'ja'

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export const SUPPORTED_LANGUAGES: Language[] = LANGUAGES.map((option) => option.code)

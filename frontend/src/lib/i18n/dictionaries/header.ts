import type { Language } from '../language'

// 헤더 상단 내비게이션 · 로그인/비로그인 액션 버튼 문구.
export const headerDictionary: Record<Language, Record<string, string>> = {
  ko: {
    features: '기능',
    aiChat: 'AI 채팅',
    community: '커뮤니티',
    profile: '프로필',
    myTrips: '내 일정',
    favorites: '즐겨찾기',
    createPlan: '일정 만들기',
    logout: '로그아웃',
    login: '로그인',
    signupCta: '무료로 시작하기',
    languageSwitcherLabel: '언어 선택',
  },
  en: {
    features: 'Features',
    aiChat: 'AI Chat',
    community: 'Community',
    profile: 'Profile',
    myTrips: 'My Trips',
    favorites: 'Favorites',
    createPlan: 'Create Plan',
    logout: 'Log out',
    login: 'Log in',
    signupCta: 'Start for Free',
    languageSwitcherLabel: 'Language selection',
  },
  ja: {
    features: '機能',
    aiChat: 'AIチャット',
    community: 'コミュニティ',
    profile: 'プロフィール',
    myTrips: 'マイ旅程',
    favorites: 'お気に入り',
    createPlan: 'プラン作成',
    logout: 'ログアウト',
    login: 'ログイン',
    signupCta: '無料で始める',
    languageSwitcherLabel: '言語選択',
  },
}

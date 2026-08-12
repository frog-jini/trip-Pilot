// 저장된 활동명(한국어 canonical 문자열)을 화면 언어에 맞게 번역해서 보여주기 위한 함수.
// destinationCatalog.ts의 실제 장소명이거나 generatePlan.ts의 범용 스타일 활동 문구와 정확히
// 일치하면 번역을 돌려주고, 그 외(사용자가 채팅으로 직접 추가한 활동명 등 자유 텍스트)는 번역할
// 방법이 없으므로 원문 그대로 돌려준다. 실제 데이터(일정에 저장되는 값)는 항상 한국어 그대로다 —
// 이 함수는 렌더링 시점에만 쓰인다.
import type { Language } from './i18n/language'
import { activityTranslations } from './i18n/dictionaries/activities'
import { communitySeedActivityTranslations } from './i18n/dictionaries/communitySeedActivities'
import { catalogPlaceTranslations } from './i18n/catalogPlaceTranslations'
import { findCatalogKey } from './destinationCatalog'

export function translateActivityLabel(activity: string, destination: string, language: Language): string {
  if (language === 'ko') return activity

  // catalogPlaceTranslations는 canonical 카탈로그 키(예: "제주")로만 등록돼 있다. 사용자가 폼에
  // 직접 입력한 destination은 "제주도", "일본"처럼 별칭/변형일 수 있어서, getCatalogPlaces()가
  // 내부적으로 쓰는 것과 같은 findCatalogKey()로 먼저 정규화한 뒤 찾는다.
  const catalogKey = findCatalogKey(destination) ?? destination
  const catalogTranslation = catalogPlaceTranslations[catalogKey]?.[activity]
  if (catalogTranslation) return catalogTranslation[language]

  const genericTranslation = activityTranslations[activity] ?? communitySeedActivityTranslations[activity]
  if (genericTranslation) return genericTranslation[language]

  return activity
}

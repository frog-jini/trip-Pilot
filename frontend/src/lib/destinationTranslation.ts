// 저장된 목적지 이름(한국어 canonical 문자열 또는 "제주도"/"도쿄" 같은 별칭)을 화면 언어에 맞게
// 번역해서 보여주기 위한 함수. activityTranslation.ts와 같은 패턴 — 저장 데이터는 항상 한국어
// 그대로 두고, 렌더링 시점에만 findCatalogKey()로 정규화한 뒤 번역을 찾는다.
import type { Language } from './i18n/language'
import { destinationNameTranslations } from './i18n/dictionaries/destinationNames'
import { findCatalogKey } from './destinationCatalog'

export function translateDestinationName(destination: string, language: Language): string {
  if (language === 'ko') return destination

  const canonicalKey = findCatalogKey(destination) ?? destination
  const translation = destinationNameTranslations[canonicalKey]

  return translation ? translation[language] : destination
}

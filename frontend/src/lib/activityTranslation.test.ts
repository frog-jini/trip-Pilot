import { translateActivityLabel } from './activityTranslation'

describe('translateActivityLabel', () => {
  it('returns the activity unchanged for Korean', () => {
    expect(translateActivityLabel('센소지 (아사쿠사)', '일본 도쿄', 'ko')).toBe('센소지 (아사쿠사)')
  })

  it('translates a catalog-backed place for a known destination', () => {
    expect(translateActivityLabel('센소지 (아사쿠사)', '일본 도쿄', 'en')).toBe('Sensoji Temple (Asakusa)')
    expect(translateActivityLabel('센소지 (아사쿠사)', '일본 도쿄', 'ja')).toBe('浅草寺(浅草)')
  })

  it('translates a generic style-pool activity regardless of destination', () => {
    expect(translateActivityLabel('대표 랜드마크 관광', '평행우주 도시', 'en')).toBe('Iconic Landmark Sightseeing')
    expect(translateActivityLabel('대표 랜드마크 관광', '평행우주 도시', 'ja')).toBe('代表的なランドマーク観光')
  })

  it('returns the original text unchanged when there is no known translation (free text)', () => {
    expect(translateActivityLabel('디즈니랜드', '일본 도쿄', 'en')).toBe('디즈니랜드')
  })

  it('does not cross-match a place name from a different destination', () => {
    // '센소지 (아사쿠사)' only exists under 일본 도쿄, not under 제주
    expect(translateActivityLabel('센소지 (아사쿠사)', '제주', 'en')).toBe('센소지 (아사쿠사)')
  })

  it('resolves a destination alias/variant to the canonical catalog key before translating', () => {
    // 사용자가 폼에 "제주도"라고 직접 입력해도(카탈로그 키는 "제주") 번역이 되어야 한다 —
    // getCatalogPlaces()/findCatalogKey()가 이미 이 별칭을 내부적으로 인식하는 것과 동일하게.
    expect(translateActivityLabel('성산일출봉 (성산읍)', '제주도', 'en')).toBe('Seongsan Ilchulbong (Seongsan-eup)')
    expect(translateActivityLabel('성산일출봉 (성산읍)', '제주도', 'ja')).toBe('城山日出峰(城山邑)')
  })

  it('resolves a country-name alias (e.g. "일본") to its representative city catalog', () => {
    expect(translateActivityLabel('센소지 (아사쿠사)', '일본', 'en')).toBe('Sensoji Temple (Asakusa)')
  })

  it('translates the hand-written community seed activity phrases (not the "{name} ({area})" catalog format)', () => {
    // 커뮤니티 데모 게시글(backend/src/db/seed.ts)은 destinationCatalog.ts 형식이 아니라 직접 쓴
    // 문장을 쓴다 — 예: "성산일출봉 일출 감상" (카탈로그의 "성산일출봉 (성산읍)"과는 다른 문자열).
    expect(translateActivityLabel('성산일출봉 일출 감상', '제주', 'en')).toBe('Seongsan Ilchulbong Sunrise Viewing')
    expect(translateActivityLabel('성산일출봉 일출 감상', '제주', 'ja')).toBe('城山日出峰 日の出鑑賞')
    expect(translateActivityLabel('아사쿠사 관광', '일본 도쿄', 'en')).toBe('Asakusa Sightseeing')
  })
})

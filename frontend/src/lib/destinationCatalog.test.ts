// 목적지별 실제 장소 데이터(destinationCatalog.ts)와, 도시명이 느슨하게(별칭·부분 문자열로도)
// 매칭되는지를 검증한다. 카탈로그에 없는 도시를 입력해도 앱이 죽지 않아야 하므로 hasCatalog가
// false인 경우의 폴백 동작(다른 테스트 파일에서 generatePlan.ts가 이어서 검증)과 짝을 이룬다.
import { getCatalogPlaces, getSupportedDestinations, hasCatalog } from './destinationCatalog'
import { parseTripPlanMessage } from './tripPlanChat'
import { emptyTripPlanFormValues } from './tripPlan'
import { STYLE_OPTIONS } from './tripPlan'

describe('hasCatalog', () => {
  it('returns true for a supported destination', () => {
    expect(hasCatalog('일본 도쿄')).toBe(true)
  })

  it('returns false for an unsupported destination', () => {
    expect(hasCatalog('평행우주 도시')).toBe(false)
  })

  it('matches loosely when the destination text contains a supported city name', () => {
    expect(hasCatalog('일본 도쿄 여행')).toBe(true)
  })

  it('matches a short alias like 도쿄 to the full 일본 도쿄 catalog entry', () => {
    expect(hasCatalog('도쿄')).toBe(true)
  })

  it('matches 제주도 to the 제주 catalog entry', () => {
    expect(hasCatalog('제주도')).toBe(true)
  })
})

describe('getCatalogPlaces', () => {
  it('returns several concrete named places for a supported destination and style', () => {
    const places = getCatalogPlaces('일본 도쿄', '가족 여행')
    expect(places.length).toBeGreaterThanOrEqual(4)
    for (const place of places) {
      expect(place.name.length).toBeGreaterThan(0)
      expect(place.area.length).toBeGreaterThan(0)
    }
  })

  it('returns different places for different destinations', () => {
    const tokyo = getCatalogPlaces('일본 도쿄', '가족 여행')
    const osaka = getCatalogPlaces('오사카', '가족 여행')
    expect(tokyo.map((p) => p.name)).not.toEqual(osaka.map((p) => p.name))
  })

  it('returns an empty list for an unsupported destination', () => {
    expect(getCatalogPlaces('평행우주 도시', '가족 여행')).toEqual([])
  })

  it('resolves places for a short alias the same way as the full destination name', () => {
    const viaAlias = getCatalogPlaces('도쿄', '쇼핑 중심')
    const viaFullName = getCatalogPlaces('일본 도쿄', '쇼핑 중심')
    expect(viaAlias).toEqual(viaFullName)
    expect(viaAlias.length).toBeGreaterThan(0)
  })
})

describe('getSupportedDestinations', () => {
  it('lists more than one supported destination', () => {
    expect(getSupportedDestinations().length).toBeGreaterThan(3)
  })

  it('includes destinations spanning multiple continents beyond the original set', () => {
    const destinations = getSupportedDestinations()
    expect(destinations).toEqual(expect.arrayContaining(['뉴욕', '런던', '로마', '시드니']))
  })

  it('includes a broad set of Asian destinations beyond the original set', () => {
    const destinations = getSupportedDestinations()
    expect(destinations).toEqual(
      expect.arrayContaining([
        '나고야',
        '교토',
        '후쿠오카',
        '서울',
        '부산',
        '홍콩',
        '타이베이',
        '상하이',
        '싱가포르',
        '쿠알라룸푸르',
        '발리',
        '세부',
        '하노이',
        '호치민',
        '치앙마이',
      ]),
    )
  })
})

const NEW_DESTINATIONS = [
  '뉴욕',
  '런던',
  '로마',
  '시드니',
  '나고야',
  '교토',
  '후쿠오카',
  '서울',
  '부산',
  '홍콩',
  '타이베이',
  '상하이',
  '싱가포르',
  '쿠알라룸푸르',
  '발리',
  '세부',
  '하노이',
  '호치민',
  '치앙마이',
]

describe('newly added destinations', () => {
  it.each(NEW_DESTINATIONS)('has places for every travel style in %s', (destination) => {
    for (const style of STYLE_OPTIONS) {
      const places = getCatalogPlaces(destination, style)
      expect(places.length).toBeGreaterThanOrEqual(4)
    }
  })
})

const ASIAN_COUNTRY_ALIASES: [string, string][] = [
  ['일본', '일본 도쿄'],
  ['한국', '서울'],
  ['중국', '상하이'],
  ['대만', '타이베이'],
  ['홍콩', '홍콩'],
  ['싱가포르', '싱가포르'],
  ['말레이시아', '쿠알라룸푸르'],
  ['인도네시아', '발리'],
  ['필리핀', '세부'],
  ['베트남', '다낭'],
  ['태국', '방콕'],
]

describe('additional aliases', () => {
  it('recognizes "미국" (USA) as an alias for the 뉴욕 catalog entry', () => {
    expect(hasCatalog('미국')).toBe(true)
    expect(getCatalogPlaces('미국', '관광 중심')).toEqual(getCatalogPlaces('뉴욕', '관광 중심'))
  })

  it('recognizes "東京" (Tokyo written in kanji) as an alias for 일본 도쿄', () => {
    expect(hasCatalog('東京')).toBe(true)
    expect(getCatalogPlaces('東京', '관광 중심')).toEqual(getCatalogPlaces('일본 도쿄', '관광 중심'))
  })
})

describe('Asian country-name aliases', () => {
  it.each(ASIAN_COUNTRY_ALIASES)('recognizes the country name %s as the %s catalog entry', (country, city) => {
    expect(hasCatalog(country)).toBe(true)
    expect(getCatalogPlaces(country, '관광 중심')).toEqual(getCatalogPlaces(city, '관광 중심'))
  })

  it.each(ASIAN_COUNTRY_ALIASES)('resolves a natural sentence mentioning %s to a real destination', (country) => {
    const result = parseTripPlanMessage(`${country}로 여행 가고 싶어`, emptyTripPlanFormValues)
    expect(result.destination).not.toBe('')
    expect(hasCatalog(result.destination)).toBe(true)
  })
})

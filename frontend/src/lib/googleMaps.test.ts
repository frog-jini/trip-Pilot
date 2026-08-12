// 활동/목적지 텍스트로 구글 지도 검색 링크를 만드는 순수 함수 테스트.
import { getGoogleMapsSearchUrl } from './googleMaps'

describe('getGoogleMapsSearchUrl', () => {
  it('builds a Google Maps search URL combining the activity and destination', () => {
    expect(getGoogleMapsSearchUrl('일본 도쿄', '아사쿠사 관광')).toBe(
      'https://www.google.com/maps/search/?api=1&query=%EC%95%84%EC%82%AC%EC%BF%A0%EC%82%AC%20%EA%B4%80%EA%B4%91%20%EC%9D%BC%EB%B3%B8%20%EB%8F%84%EC%BF%84',
    )
  })

  it('url-encodes special characters safely', () => {
    const url = getGoogleMapsSearchUrl('제주', '성산일출봉 (성산읍)')
    expect(url).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('성산일출봉 (성산읍) 제주')}`,
    )
  })
})

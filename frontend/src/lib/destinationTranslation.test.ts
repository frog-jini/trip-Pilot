import { translateDestinationName } from './destinationTranslation'

describe('translateDestinationName', () => {
  it('returns the name unchanged for Korean', () => {
    expect(translateDestinationName('일본 도쿄', 'ko')).toBe('일본 도쿄')
  })

  it('translates a canonical destination name', () => {
    expect(translateDestinationName('일본 도쿄', 'en')).toBe('Tokyo, Japan')
    expect(translateDestinationName('일본 도쿄', 'ja')).toBe('日本 東京')
    expect(translateDestinationName('제주', 'en')).toBe('Jeju')
  })

  it('resolves an alias/variant to the canonical name before translating', () => {
    expect(translateDestinationName('제주도', 'en')).toBe('Jeju')
    expect(translateDestinationName('도쿄', 'en')).toBe('Tokyo, Japan')
  })

  it('resolves real DB-stored variants like "東京" (kanji) and "미국" (country name) before translating', () => {
    expect(translateDestinationName('東京', 'en')).toBe('Tokyo, Japan')
    expect(translateDestinationName('東京', 'ja')).toBe('日本 東京')
    expect(translateDestinationName('미국', 'en')).toBe('New York')
  })

  it('returns the original text unchanged for a destination with no catalog/translation', () => {
    expect(translateDestinationName('평행우주 도시', 'en')).toBe('평행우주 도시')
  })
})

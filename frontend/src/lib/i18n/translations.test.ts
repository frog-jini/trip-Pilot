import { translate, interpolate } from './translations'

describe('translate', () => {
  it('resolves a known key for the requested language', () => {
    expect(translate('en', 'header.features')).toBe('Features')
    expect(translate('ja', 'header.features')).toBe('機能')
    expect(translate('ko', 'header.features')).toBe('기능')
  })

  it('returns the key unchanged when the namespace does not exist', () => {
    expect(translate('en', 'nonexistent.key')).toBe('nonexistent.key')
  })

  it('returns the full key unchanged when the entry does not exist in a known namespace', () => {
    expect(translate('en', 'header.nonexistentEntry')).toBe('header.nonexistentEntry')
  })

})

describe('interpolate', () => {
  it('substitutes a {{placeholder}} with the given value', () => {
    expect(interpolate('안녕, {{name}}!', { name: '지니' })).toBe('안녕, 지니!')
  })

  it('substitutes multiple different placeholders', () => {
    expect(interpolate('{{destination}} · {{duration}} 일정', { destination: '도쿄', duration: '3박 4일' })).toBe(
      '도쿄 · 3박 4일 일정',
    )
  })

  it('substitutes every occurrence when the same placeholder repeats', () => {
    expect(interpolate('{{count}}개 중 {{count}}개 완료', { count: 3 })).toBe('3개 중 3개 완료')
  })

  it('returns the template unchanged when no params are given', () => {
    expect(interpolate('그대로 유지')).toBe('그대로 유지')
  })

  it('leaves unmatched placeholders as-is', () => {
    expect(interpolate('{{missing}} 값', {})).toBe('{{missing}} 값')
  })
})

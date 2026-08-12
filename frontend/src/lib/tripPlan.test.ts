import { translateStyleTag } from './tripPlan'
import { translate } from './i18n/translations'

const t = (key: string, params?: Record<string, string | number>) => translate('en', key, params)

describe('translateStyleTag', () => {
  it('translates a known travel style', () => {
    expect(translateStyleTag('관광 중심', t)).toBe('Sightseeing')
    expect(translateStyleTag('힐링 여행', t)).toBe('Relaxing')
  })

  it('translates the custom-tag fallback used when no style was selected', () => {
    expect(translateStyleTag('나만의 여행', t)).toBe('My Trip')
  })

  it('returns unrecognized tags unchanged', () => {
    expect(translateStyleTag('알 수 없는 태그', t)).toBe('알 수 없는 태그')
  })
})

import { readStoredLanguage, writeStoredLanguage, clearStoredLanguage } from './languageStorage'

describe('languageStorage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredLanguage()).toBeNull()
  })

  it('round-trips a written language', () => {
    writeStoredLanguage('en')
    expect(readStoredLanguage()).toBe('en')
  })

  it('round-trips each supported language', () => {
    writeStoredLanguage('ja')
    expect(readStoredLanguage()).toBe('ja')

    writeStoredLanguage('ko')
    expect(readStoredLanguage()).toBe('ko')
  })

  it('ignores an invalid/corrupted stored value instead of throwing', () => {
    localStorage.setItem('trippilot_language', 'fr')
    expect(readStoredLanguage()).toBeNull()
  })

  it('clears the stored language', () => {
    writeStoredLanguage('ja')
    clearStoredLanguage()
    expect(readStoredLanguage()).toBeNull()
  })
})

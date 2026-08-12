// useLanguage()가 Provider 없이도(기본값 = 한국어) 동작하는지, Provider로 감쌌을 때 전환·저장이
// 되는지, 그리고 재방문 시 저장된 언어를 복원하는지를 검증한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from './LanguageContext'
import { useLanguage } from './languageContextValue'
import { readStoredLanguage, writeStoredLanguage } from '../lib/i18n/languageStorage'

function Consumer() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="translated">{t('header.features')}</span>
      <button onClick={() => setLanguage('en')}>switch to en</button>
    </div>
  )
}

describe('useLanguage without a LanguageProvider', () => {
  it('falls back to Korean instead of throwing', () => {
    render(<Consumer />)
    expect(screen.getByTestId('language')).toHaveTextContent('ko')
    expect(screen.getByTestId('translated')).toHaveTextContent('기능')
  })
})

describe('LanguageProvider', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to Korean when nothing is stored', () => {
    render(
      <LanguageProvider>
        <Consumer />
      </LanguageProvider>,
    )
    expect(screen.getByTestId('language')).toHaveTextContent('ko')
    expect(screen.getByTestId('translated')).toHaveTextContent('기능')
  })

  it('restores a previously stored language on mount', () => {
    writeStoredLanguage('ja')
    render(
      <LanguageProvider>
        <Consumer />
      </LanguageProvider>,
    )
    expect(screen.getByTestId('language')).toHaveTextContent('ja')
    expect(screen.getByTestId('translated')).toHaveTextContent('機能')
  })

  it('updates the language and persists it when setLanguage is called', async () => {
    const user = userEvent.setup()
    render(
      <LanguageProvider>
        <Consumer />
      </LanguageProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'switch to en' }))

    expect(screen.getByTestId('language')).toHaveTextContent('en')
    expect(screen.getByTestId('translated')).toHaveTextContent('Features')
    expect(readStoredLanguage()).toBe('en')
  })
})

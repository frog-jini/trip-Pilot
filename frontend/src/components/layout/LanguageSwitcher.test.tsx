import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageSwitcher } from './LanguageSwitcher'
import { LanguageProvider } from '../../context/LanguageContext'
import { readStoredLanguage } from '../../lib/i18n/languageStorage'

function renderSwitcher() {
  return render(
    <LanguageProvider>
      <LanguageSwitcher />
    </LanguageProvider>,
  )
}

describe('LanguageSwitcher', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('renders a button for each supported language', () => {
    renderSwitcher()
    expect(screen.getByRole('button', { name: '한국어' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '日本語' })).toBeInTheDocument()
  })

  it('marks Korean as selected by default', () => {
    renderSwitcher()
    expect(screen.getByRole('button', { name: '한국어' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '日本語' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the selected language and persists it when clicked', async () => {
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '한국어' })).toHaveAttribute('aria-pressed', 'false')
    expect(readStoredLanguage()).toBe('en')
  })

  it('switches to Japanese when clicked', async () => {
    const user = userEvent.setup()
    renderSwitcher()

    await user.click(screen.getByRole('button', { name: '日本語' }))

    expect(screen.getByRole('button', { name: '日本語' })).toHaveAttribute('aria-pressed', 'true')
    expect(readStoredLanguage()).toBe('ja')
  })
})

// 폼 입력/검증/제출뿐 아니라, 목적지가 일치하는 즐겨찾기를 "꼭 가고 싶은 곳"에 자동 병합하는
// 동작(마운트 시 + 목적지 직접 입력 시)까지 검증한다.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TripPlanForm } from './TripPlanForm'
import { LanguageProvider } from '../../context/LanguageContext'
import { writeStoredLanguage } from '../../lib/i18n/languageStorage'
import { todayIso } from '../../lib/dateUtils'
import type { FavoritePlace } from '../../lib/favoritesStorage'

describe('TripPlanForm', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('translates the duration select and style buttons when the language is English', () => {
    writeStoredLanguage('en')
    render(
      <LanguageProvider>
        <TripPlanForm onSubmit={vi.fn()} />
      </LanguageProvider>,
    )
    expect(screen.getByRole('option', { name: '2 Nights 3 Days' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shopping' })).toBeInTheDocument()
  })

  it('renders every input field', () => {
    render(<TripPlanForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('여행지')).toBeInTheDocument()
    expect(screen.getByLabelText('여행 시작일')).toBeInTheDocument()
    expect(screen.getByLabelText('여행 기간')).toBeInTheDocument()
    expect(screen.getByLabelText('여행 인원')).toBeInTheDocument()
    expect(screen.getByLabelText('예산 (만원)')).toBeInTheDocument()
    expect(screen.getByLabelText('숙소 위치 (선택)')).toBeInTheDocument()
    expect(screen.getByLabelText('꼭 가고 싶은 곳 (선택)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '관광 중심' })).toBeInTheDocument()
  })

  it('defaults the start date to today', () => {
    render(<TripPlanForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('여행 시작일')).toHaveValue(todayIso())
  })

  it('includes the chosen start date when the form is submitted', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TripPlanForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.clear(screen.getByLabelText('여행 시작일'))
    await user.type(screen.getByLabelText('여행 시작일'), '2026-08-01')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-08-01' }))
  })

  it('shows validation errors and does not submit when required fields are empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TripPlanForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    expect(await screen.findByText('여행지를 입력해주세요.')).toBeInTheDocument()
    expect(screen.getByText('여행 인원을 입력해주세요.')).toBeInTheDocument()
    expect(screen.getByText('예산을 입력해주세요.')).toBeInTheDocument()
    expect(screen.getByText('여행 스타일을 하나 이상 선택해주세요.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('toggles a travel style chip on and off', async () => {
    const user = userEvent.setup()
    render(<TripPlanForm onSubmit={vi.fn()} />)

    const chip = screen.getByRole('button', { name: '쇼핑 중심' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onSubmit with the entered values when the form is valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TripPlanForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('여행지'), '일본 도쿄')
    await user.type(screen.getByLabelText('여행 인원'), '2')
    await user.type(screen.getByLabelText('예산 (만원)'), '100')
    await user.click(screen.getByRole('button', { name: '쇼핑 중심' }))
    await user.click(screen.getByRole('button', { name: '맛집 중심' }))
    await user.click(screen.getByRole('button', { name: 'AI 일정 만들기' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: '일본 도쿄',
        duration: '2박 3일',
        travelers: '2',
        budget: '100',
        styles: ['쇼핑 중심', '맛집 중심'],
      }),
    )
  })

  it('pre-fills fields from initialValues when provided', () => {
    render(
      <TripPlanForm
        onSubmit={vi.fn()}
        initialValues={{ destination: '일본 도쿄', mustVisit: '센소지 (아사쿠사), 도쿄타워' }}
      />,
    )

    expect(screen.getByLabelText('여행지')).toHaveValue('일본 도쿄')
    expect(screen.getByLabelText('꼭 가고 싶은 곳 (선택)')).toHaveValue('센소지 (아사쿠사), 도쿄타워')
  })

  it('merges favorited places for the initial destination into must-visit on mount', () => {
    const favorites: FavoritePlace[] = [{ id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' }]

    render(
      <TripPlanForm onSubmit={vi.fn()} initialValues={{ destination: '일본 도쿄' }} favorites={favorites} />,
    )

    expect(screen.getByLabelText('꼭 가고 싶은 곳 (선택)')).toHaveValue('아사쿠사 관광')
  })

  it('applies favorites once they finish loading after the initial mount', () => {
    const favorites: FavoritePlace[] = [{ id: 'f1', destination: '일본 도쿄', activity: '아사쿠사 관광' }]

    const { rerender } = render(
      <TripPlanForm onSubmit={vi.fn()} initialValues={{ destination: '일본 도쿄' }} favorites={[]} />,
    )
    expect(screen.getByLabelText('꼭 가고 싶은 곳 (선택)')).toHaveValue('')

    rerender(
      <TripPlanForm onSubmit={vi.fn()} initialValues={{ destination: '일본 도쿄' }} favorites={favorites} />,
    )

    expect(screen.getByLabelText('꼭 가고 싶은 곳 (선택)')).toHaveValue('아사쿠사 관광')
  })

  it('merges favorited places for a destination typed directly into the form', async () => {
    const user = userEvent.setup()
    const favorites: FavoritePlace[] = [{ id: 'f1', destination: '오사카', activity: '도톤보리 맛집 탐방' }]

    render(<TripPlanForm onSubmit={vi.fn()} favorites={favorites} />)

    await user.type(screen.getByLabelText('여행지'), '오사카')
    await user.tab()

    expect(screen.getByLabelText('꼭 가고 싶은 곳 (선택)')).toHaveValue('도톤보리 맛집 탐방')
  })
})

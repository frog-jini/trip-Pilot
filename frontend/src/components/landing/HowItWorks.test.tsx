// 정적 4단계 안내 섹션 — 순서가 뒤바뀌면 사용자 흐름 설명이 어색해지므로 순서까지 검증한다.
import { render, screen } from '@testing-library/react'
import { HowItWorks } from './HowItWorks'

describe('HowItWorks', () => {
  it('renders the four steps of the planning flow in order', () => {
    render(<HowItWorks />)
    const steps = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)
    expect(steps).toEqual(['여행 정보 입력', 'AI 일정 생성', '자유롭게 수정', '저장하고 공유'])
  })
})

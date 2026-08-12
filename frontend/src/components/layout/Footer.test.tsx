// 저작권 연도가 하드코딩되지 않고 항상 "현재" 연도를 반영하는지 확인한다(연말 배포 후 방치돼도 틀리지 않도록).
import { render, screen } from '@testing-library/react'
import { Footer } from './Footer'

describe('Footer', () => {
  it('renders the brand name', () => {
    render(<Footer />)
    expect(screen.getByText('Trailot')).toBeInTheDocument()
  })

  it('renders the current year in the copyright notice', () => {
    render(<Footer />)
    const year = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument()
  })
})

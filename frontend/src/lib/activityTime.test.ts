// activityTime.ts(사용자가 직접 지정한 활동별 시간 기록)에 대한 단위 테스트.
// activityCost.ts와 구조가 동일해서(값이 없으면 자동 계산으로 폴백) 테스트 형태도 그대로 대응된다.
import { setActivityTime } from './activityTime'

describe('setActivityTime', () => {
  it('records a time for an activity on a given day, leaving other days untouched', () => {
    const next = setActivityTime({}, 1, '센소지 (아사쿠사)', '10:30')
    expect(next).toEqual({ 1: { '센소지 (아사쿠사)': '10:30' } })
  })

  it('overwrites an existing entry for the same activity', () => {
    const initial = { 1: { '센소지 (아사쿠사)': '10:30' } }
    const next = setActivityTime(initial, 1, '센소지 (아사쿠사)', '14:00')
    expect(next).toEqual({ 1: { '센소지 (아사쿠사)': '14:00' } })
  })

  it('removes the entry when the time is empty', () => {
    const initial = { 1: { '센소지 (아사쿠사)': '10:30', '이치란 라멘 신주쿠점': '12:00' } }
    const next = setActivityTime(initial, 1, '센소지 (아사쿠사)', '')
    expect(next).toEqual({ 1: { '이치란 라멘 신주쿠점': '12:00' } })
  })

  it('keeps entries for other days independent', () => {
    const initial = { 1: { '센소지 (아사쿠사)': '10:30' } }
    const next = setActivityTime(initial, 2, '도쿄타워 (미나토)', '09:00')
    expect(next).toEqual({
      1: { '센소지 (아사쿠사)': '10:30' },
      2: { '도쿄타워 (미나토)': '09:00' },
    })
  })

  it('does not mutate the input', () => {
    const initial = { 1: { '센소지 (아사쿠사)': '10:30' } }
    setActivityTime(initial, 1, '센소지 (아사쿠사)', '14:00')
    expect(initial).toEqual({ 1: { '센소지 (아사쿠사)': '10:30' } })
  })
})

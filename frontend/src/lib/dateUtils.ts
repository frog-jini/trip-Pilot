// 날짜 계산/표시 유틸. 일정의 시작일로부터 각 일차의 실제 날짜를 구하거나(addDaysIso),
// 화면에 "7월 26일 (일)" 같은 한국어 형식으로 보여줄 때(formatItineraryDate) 쓰인다.

export function todayIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 날짜 계산은 연/월/일 숫자만 가지고 UTC 기준 Date 메서드로 처리하고, 로컬 시간으로 파싱하지 않는다.
// "YYYY-MM-DDT00:00:00"을 로컬 시간으로 파싱한 뒤 toISOString(UTC)으로 다시 읽으면, UTC보다
// 앞선 시간대(예: 한국, UTC+9)에서는 날짜가 조용히 하루 밀린다. 게다가 이 함수는 연달아 여러 번
// 호출되기 때문에(일차별 날짜를 구한 뒤, 그 날짜로 다시 날씨 예보 기간을 구함) 밀린 날짜가
// 상쇄되지 않고 계속 쌓인다.
export function addDaysIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const ITINERARY_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

export function formatItineraryDate(dateIso: string): string {
  return ITINERARY_DATE_FORMATTER.format(new Date(`${dateIso}T00:00:00`))
}

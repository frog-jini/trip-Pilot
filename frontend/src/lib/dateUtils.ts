// 날짜 계산/표시 유틸. 일정의 시작일로부터 각 일차의 실제 날짜를 구하거나(addDaysIso),
// 화면에 "7월 26일 (일)" 같은 한국어 형식으로 보여줄 때(formatItineraryDate) 쓰인다.

export function todayIso(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Does calendar-date arithmetic purely on the Y/M/D numbers via UTC-anchored Date methods,
// never through a local-time parse. Parsing "YYYY-MM-DDT00:00:00" as local time and reading
// it back via toISOString (UTC) silently shifts the date by a day in any UTC-ahead timezone
// (e.g. Korea, UTC+9) — and since this function is called more than once in sequence
// (itinerary day dates, then forecast date ranges derived from those dates), that shift
// compounds instead of canceling out.
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

// 활동별 "📍" 아이콘이 여는 링크. 페이지 내 임베드 지도가 아니라 구글 지도 검색 결과로 보내는
// 방식이라 API 키가 따로 필요 없다 — MAP-01은 그래서 "부분구현"으로 표기되어 있다.
export function getGoogleMapsSearchUrl(destination: string, activity: string): string {
  const query = `${activity} ${destination}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

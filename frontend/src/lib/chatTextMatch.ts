// chatIntent.ts(일정 상세 채팅)와 tripPlanChat.ts(대화로 일정 만들기)가 공통으로 쓰는, 언어와
// 무관한 순수 텍스트 매칭 유틸리티. 두 곳 모두 "규칙 기반 파서가 먼저, AI는 보너스" 철학을 쓰며
// 이 헬퍼들에 의존한다.

// 일본어 IME는 숫자를 반각(半角, ASCII 0-9)이 아니라 전각(全角, １２３...)으로 입력하는 경우가
// 흔한데, 정규식의 \d는 반각 숫자만 매칭한다. 그래서 매칭 전에 전각 숫자를 반각으로 정규화해둔다
// (언어 무관하게 적용해도 다른 언어 입력에는 전각 숫자가 나타나지 않으므로 부작용이 없다).
export function normalizeFullWidthDigits(message: string): string {
  return message.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 영어처럼 공백으로 단어가 구분되는 언어의 키워드는 \b(단어 경계)로 감싸서 매칭해야
// "train" 안의 "rain", "tourist" 안의 "tour"처럼 다른 단어에 우연히 포함된 부분 문자열을
// 오인식하지 않는다. 반면 한국어/일본어는 조사가 공백 없이 바로 붙어서(예: "비가") \b가 애초에
// 성립하지 않으므로, 라틴 문자로만 이뤄진 키워드에만 적용한다.
export const ASCII_WORD_KEYWORD = /^[a-z0-9][a-z0-9\s'-]*$/i

export function keywordMatches(lowerMessage: string, keyword: string): boolean {
  const lowerKeyword = keyword.toLowerCase()
  if (ASCII_WORD_KEYWORD.test(lowerKeyword)) {
    return new RegExp(`\\b${escapeRegExp(lowerKeyword)}\\b`).test(lowerMessage)
  }
  return lowerMessage.includes(lowerKeyword)
}

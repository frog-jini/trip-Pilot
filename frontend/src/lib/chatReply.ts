// 채팅 답장을 "그 시점에 완성된 문자열"이 아니라, 번역 키+파라미터를 들고 있다가 렌더링 시점의
// t()로 다시 조립하는 함수(ChatReply)로 표현한다. 그래야 이미 화면에 찍힌 과거 메시지도 언어를
// 바꾸는 순간 새 언어의 문장 틀로 다시 그려진다 — 사용자가 채팅으로 직접 입력한 활동명 같은 자유
// 텍스트는 params 안에 원문 그대로 남아있으니, 그 부분만은 번역되지 않고 그대로 유지된다.
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export type ChatReply = (t: TranslateFn) => string

export function reply(key: string, params?: Record<string, string | number>): ChatReply {
  return (t) => t(key, params)
}

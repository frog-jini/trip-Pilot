// 프론트(Kakao SDK)가 로그인 성공 후 받은 access_token을 그대로 믿지 않고, 카카오 사용자 정보
// API에 그 토큰으로 직접 물어봐서 검증한다 — 토큰이 유효하지 않으면 카카오가 401을 돌려준다
// (구글의 verifyGoogleIdToken과 달리 로컬 서명 검증이 아니라 카카오 서버에 매번 확인을 맡긴다).
export interface KakaoProfile {
  id: string
  email: string | null
  nickname: string | null
}

interface KakaoUserMeResponse {
  id?: number
  kakao_account?: {
    email?: string
    is_email_verified?: boolean
  }
  properties?: {
    nickname?: string
  }
}

export async function verifyKakaoAccessToken(accessToken: string): Promise<KakaoProfile | null> {
  try {
    const response = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null

    const data = (await response.json()) as KakaoUserMeResponse
    if (!data.id) return null

    // 이메일 동의를 안 했거나 인증되지 않은 계정이면 카카오가 이메일을 안 줄 수 있다 — 그 경우
    // null로 두고, 호출부(auth.ts)가 자리표시 이메일을 대신 채운다.
    const email = data.kakao_account?.is_email_verified ? (data.kakao_account.email ?? null) : null
    // 닉네임은 이메일과 달리 동의 없이도 기본으로 제공되는 값이라, 화면에는 이메일/자리표시
    // 주소 대신 이 값을 우선 보여준다(있으면).
    const nickname = data.properties?.nickname ?? null
    return { id: String(data.id), email, nickname }
  } catch {
    return null
  }
}

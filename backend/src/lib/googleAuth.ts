// 프론트(Google Identity Services)가 보내주는 id_token을 검증해서 실제 구글 계정인지 확인한다.
// audience를 우리 GOOGLE_CLIENT_ID로 고정해두므로, 다른 앱용으로 발급된 토큰은 통과하지 못한다.
import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client()

export interface GoogleProfile {
  sub: string
  email: string
  name: string | null
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile | null> {
  const audience = process.env.GOOGLE_CLIENT_ID
  if (!audience) return null

  try {
    const ticket = await client.verifyIdToken({ idToken, audience })
    const payload = ticket.getPayload()
    if (!payload?.sub || !payload.email) return null
    // 이메일 인증이 안 된 계정이면 이걸로 기존 비밀번호 계정에 자동 연결/생성이 되면 안 되므로
    // 여기서 거른다 — 검증 실패와 동일하게 취급(auth.ts에서 401로 응답).
    if (!payload.email_verified) return null
    return { sub: payload.sub, email: payload.email, name: payload.name ?? null }
  } catch {
    return null
  }
}

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
    return { sub: payload.sub, email: payload.email, name: payload.name ?? null }
  } catch {
    return null
  }
}

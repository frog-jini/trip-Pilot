// /oauth/google와 /oauth/kakao가 공통으로 쓰는 "찾거나 만들기" 로직. 두 라우트 모두 검증된
// 프로바이더 프로필(provider + providerId + email + name)을 가지고 (1) 이미 그 프로바이더로
// 가입한 계정을 찾고, 없으면 (2) 같은 이메일의 기존 비밀번호 계정에 연결하고, 그것도 없으면
// (3) 새 계정을 만든다 — 세 경우 모두 닉네임은 COALESCE로 최초 1회만 채운다(auth.ts의
// 기존 주석 참고: 사용자가 /account에서 바꾼 닉네임을 다음 로그인 때 도로 덮어쓰지 않기 위함).
import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'

export interface OAuthProfile {
  provider: 'google' | 'kakao'
  providerId: string
  // 이메일 동의/인증을 안 한 카카오 계정처럼 이메일이 아예 없을 수 있다 — 그 경우 users.email이
  // NOT NULL이라 provider_id 기반의 자리표시 이메일을 대신 채운다(실제 식별은 항상 provider+
  // provider_id로만 하므로 이 값이 사용자에게 노출되거나 쓰일 일은 없다).
  email: string | null
  name: string | null
}

export interface OAuthUserResult {
  id: string
  email: string
  nickname: string | null
  created: boolean
}

export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<OAuthUserResult> {
  const { provider, providerId, email, name } = profile

  const byProvider = await pool.query('SELECT id, email FROM users WHERE provider = $1 AND provider_id = $2', [
    provider,
    providerId,
  ])
  if (byProvider.rows.length > 0) {
    const user = byProvider.rows[0]
    const updated = await pool.query('UPDATE users SET nickname = COALESCE(nickname, $1) WHERE id = $2 RETURNING nickname', [
      name,
      user.id,
    ])
    return { id: user.id, email: user.email, nickname: updated.rows[0].nickname, created: false }
  }

  // 같은 이메일로 이미 이메일/비밀번호 계정이 있으면(이메일을 받은 경우에 한해), 새 계정을 또
  // 만들지 않고 그 계정에 이 프로바이더 로그인을 연결한다.
  if (email) {
    const byEmail = await pool.query('SELECT id, email FROM users WHERE email = $1', [email])
    if (byEmail.rows.length > 0) {
      const user = byEmail.rows[0]
      const updated = await pool.query(
        'UPDATE users SET provider = $1, provider_id = $2, nickname = COALESCE(nickname, $3) WHERE id = $4 RETURNING nickname',
        [provider, providerId, name, user.id],
      )
      return { id: user.id, email: user.email, nickname: updated.rows[0].nickname, created: false }
    }
  }

  const id = randomUUID()
  const finalEmail = email ?? `${provider}-${providerId}@${provider}user.trippilot.invalid`
  await pool.query('INSERT INTO users (id, email, provider, provider_id, nickname) VALUES ($1, $2, $3, $4, $5)', [
    id,
    finalEmail,
    provider,
    providerId,
    name,
  ])
  return { id, email: finalEmail, nickname: name, created: true }
}

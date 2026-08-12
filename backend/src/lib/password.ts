// 비밀번호를 평문으로 저장하지 않기 위한 해시/검증 함수. bcrypt 등 별도 패키지 없이
// Node 내장 scrypt로 처리해서 의존성을 늘리지 않는다.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

// 계정마다 다른 salt를 쓰기 때문에, 같은 비밀번호라도 저장되는 해시값이 매번 달라진다
// (레인보우 테이블류 공격 방어). "salt:hash" 형태 하나의 문자열로 저장해서 컬럼을 늘리지 않는다.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

// 문자열을 그냥 ===로 비교하지 않고 timingSafeEqual을 쓰는 이유: 비교에 걸리는 시간 차이로
// 해시를 한 글자씩 유추하는 타이밍 공격을 막기 위함이다.
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false

  const keyBuffer = Buffer.from(key, 'hex')
  const derivedKey = (await scrypt(password, salt, keyBuffer.length)) as Buffer
  return keyBuffer.length === derivedKey.length && timingSafeEqual(keyBuffer, derivedKey)
}

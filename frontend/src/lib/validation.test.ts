// 로그인/회원가입 폼의 이메일·비밀번호 형식 검증 규칙을 확인한다.
import { isValidEmail, isValidPassword, validateLoginForm, validateSignupForm } from './validation'

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it.each(['', 'user', 'user@', 'user@example', '@example.com', 'user example@a.com'])(
    'rejects %s',
    (value) => {
      expect(isValidEmail(value)).toBe(false)
    },
  )
})

describe('isValidPassword', () => {
  it('accepts a password with at least 8 characters', () => {
    expect(isValidPassword('password1')).toBe(true)
  })

  it('rejects a password shorter than 8 characters', () => {
    expect(isValidPassword('short1')).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(isValidPassword('')).toBe(false)
  })
})

describe('validateLoginForm', () => {
  it('returns no errors for a valid email and password', () => {
    const errors = validateLoginForm({ email: 'user@example.com', password: 'password1' })
    expect(errors).toEqual({})
  })

  it('returns an email error when the email is empty', () => {
    const errors = validateLoginForm({ email: '', password: 'password1' })
    expect(errors.email).toBe('auth.errorEmailRequired')
  })

  it('returns an email error when the email format is invalid', () => {
    const errors = validateLoginForm({ email: 'not-an-email', password: 'password1' })
    expect(errors.email).toBe('auth.errorEmailInvalid')
  })

  it('returns a password error when the password is empty', () => {
    const errors = validateLoginForm({ email: 'user@example.com', password: '' })
    expect(errors.password).toBe('auth.errorPasswordRequired')
  })
})

describe('validateSignupForm', () => {
  const base = {
    email: 'user@example.com',
    password: 'password1',
    passwordConfirm: 'password1',
  }

  it('returns no errors for a valid signup form', () => {
    expect(validateSignupForm(base)).toEqual({})
  })

  it('returns an email error when the email format is invalid', () => {
    const errors = validateSignupForm({ ...base, email: 'not-an-email' })
    expect(errors.email).toBe('auth.errorEmailInvalid')
  })

  it('returns a password error when the password is shorter than 8 characters', () => {
    const errors = validateSignupForm({ ...base, password: 'short1', passwordConfirm: 'short1' })
    expect(errors.password).toBe('auth.errorPasswordTooShort')
  })

  it('returns a passwordConfirm error when the passwords do not match', () => {
    const errors = validateSignupForm({ ...base, passwordConfirm: 'different1' })
    expect(errors.passwordConfirm).toBe('auth.errorPasswordMismatch')
  })
})

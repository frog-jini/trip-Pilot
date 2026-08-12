// 로그인/회원가입 폼 검증. 에러 필드에는 문구 자체가 아니라 i18n 번역 키(예: "auth.errorEmailRequired")를
// 담는다 — 이 파일은 언어와 무관한 순수 검증 로직만 갖고, 실제 문구로 바꾸는 건 렌더링하는
// 컴포넌트(LoginForm/SignupForm)가 useLanguage().t(key)로 담당한다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

export function isValidPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH
}

export interface LoginFormValues {
  email: string
  password: string
}

export interface LoginFormErrors {
  email?: string
  password?: string
}

export function validateLoginForm({ email, password }: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {}

  if (!email) {
    errors.email = 'auth.errorEmailRequired'
  } else if (!isValidEmail(email)) {
    errors.email = 'auth.errorEmailInvalid'
  }

  if (!password) {
    errors.password = 'auth.errorPasswordRequired'
  }

  return errors
}

export interface SignupFormValues {
  email: string
  password: string
  passwordConfirm: string
}

export interface SignupFormErrors {
  email?: string
  password?: string
  passwordConfirm?: string
}

export function validateSignupForm({
  email,
  password,
  passwordConfirm,
}: SignupFormValues): SignupFormErrors {
  const errors: SignupFormErrors = {}

  if (!email) {
    errors.email = 'auth.errorEmailRequired'
  } else if (!isValidEmail(email)) {
    errors.email = 'auth.errorEmailInvalid'
  }

  if (!password) {
    errors.password = 'auth.errorPasswordRequired'
  } else if (!isValidPassword(password)) {
    errors.password = 'auth.errorPasswordTooShort'
  }

  if (passwordConfirm !== password) {
    errors.passwordConfirm = 'auth.errorPasswordMismatch'
  }

  return errors
}

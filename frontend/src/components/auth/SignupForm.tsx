// 회원가입 폼 — LoginForm과 같은 구조(검증까지만 하고 실제 가입 처리는 onSubmit으로 위임).
// 비밀번호 확인란까지 있어서 validateSignupForm이 LoginForm의 검증보다 규칙이 더 많다.
import { useRef, useState, type FormEvent, type FocusEvent } from 'react'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/languageContextValue'
import {
  isValidEmail,
  validateSignupForm,
  type SignupFormErrors,
  type SignupFormValues,
} from '../../lib/validation'

interface SignupFormProps {
  onSubmit: (values: SignupFormValues) => void
  // 제출 전에 이메일 칸에서 벗어날 때 미리 중복 여부를 물어보기 위한 훅. 없으면(테스트 등)
  // 그냥 제출 시점의 서버 응답으로만 걸러진다.
  onCheckEmail?: (email: string) => Promise<boolean>
}

export function SignupForm({ onSubmit, onCheckEmail }: SignupFormProps) {
  const { t } = useLanguage()
  const [values, setValues] = useState<SignupFormValues>({
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState<SignupFormErrors>({})
  // blur마다 새로 발급해서, 늦게 도착한 이전 확인 응답이 최신 입력값을 덮어쓰지 않게 한다.
  const emailCheckRef = useRef(0)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateSignupForm(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values)
    }
  }

  async function handleEmailBlur(event: FocusEvent<HTMLInputElement>) {
    const email = event.target.value
    if (!onCheckEmail || !isValidEmail(email)) return

    const requestId = ++emailCheckRef.current
    const available = await onCheckEmail(email)
    if (requestId !== emailCheckRef.current) return

    setErrors((prev) => ({ ...prev, email: available ? undefined : 'auth.errorEmailTaken' }))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label={t('auth.emailLabel')}
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email ? t(errors.email) : undefined}
        onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
        onBlur={handleEmailBlur}
      />

      <TextField
        label={t('auth.passwordLabel')}
        name="password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        error={errors.password ? t(errors.password) : undefined}
        onChange={(e) => setValues((prev) => ({ ...prev, password: e.target.value }))}
      />

      <TextField
        label={t('auth.passwordConfirmLabel')}
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        value={values.passwordConfirm}
        error={errors.passwordConfirm ? t(errors.passwordConfirm) : undefined}
        onChange={(e) => setValues((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full">
        {t('auth.signupSubmit')}
      </Button>
    </form>
  )
}

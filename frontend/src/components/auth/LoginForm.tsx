// 로그인 폼 — 실제 로그인 API 호출은 하지 않고, 값 검증까지만 하고 onSubmit으로 상위(LoginPage)에
// 넘긴다. 그래야 이 컴포넌트는 백엔드/인증 방식과 무관하게 재사용/테스트할 수 있다.
import { useState, type FormEvent } from 'react'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/languageContextValue'
import { validateLoginForm, type LoginFormErrors, type LoginFormValues } from '../../lib/validation'

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => void
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const { t } = useLanguage()
  const [values, setValues] = useState<LoginFormValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginFormErrors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // 클라이언트 쪽 검증만 통과하면 제출한다 — 이메일/비밀번호가 실제로 맞는지는
    // onSubmit을 호출한 쪽(서버 응답)이 판단한다.
    const nextErrors = validateLoginForm(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values)
    }
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
      />

      <TextField
        label={t('auth.passwordLabel')}
        name="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        error={errors.password ? t(errors.password) : undefined}
        onChange={(e) => setValues((prev) => ({ ...prev, password: e.target.value }))}
      />

      <Button type="submit" variant="primary" size="lg" className="w-full">
        {t('auth.loginSubmit')}
      </Button>
    </form>
  )
}

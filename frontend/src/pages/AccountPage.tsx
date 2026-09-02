import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/TextField'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { isValidPassword } from '../lib/validation'

// /account 화면. 로그인한 계정의 닉네임·비밀번호 변경과 회원 탈퇴를 처리한다.
// 가입 때 쓴 이메일은 계정 식별자라 고정이고(변경 기능 없음, 읽기 전용으로만 보여줌),
// 화면에 표시되는 이름은 닉네임으로만 바꿀 수 있다(Header.tsx/community.ts와 일관).
export function AccountPage() {
  const { user, updateNickname, updatePassword, deleteAccount } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(user?.nickname ?? '')
  const [nicknameMessage, setNicknameMessage] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  // 헤더/커뮤니티 등 화면에 실제로 표시되는 이름은 이메일이 아니라 닉네임이다(Header.tsx,
  // 백엔드 community.ts 참고) — 이메일은 로그인 식별자 역할만 하도록 분리해뒀다.
  async function handleNicknameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    if (!nickname.trim()) {
      setNicknameMessage(t('account.nicknameRequired'))
      return
    }

    const success = await updateNickname(nickname.trim())
    setNicknameMessage(success ? t('account.nicknameChanged') : t('account.nicknameRequired'))
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    if (!isValidPassword(newPassword)) {
      setPasswordMessage(t('account.passwordTooShort'))
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordMessage(t('account.passwordMismatch'))
      return
    }

    const success = await updatePassword(currentPassword, newPassword)
    if (success) {
      setPasswordMessage(t('account.passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    } else {
      setPasswordMessage(t('account.currentPasswordWrong'))
    }
  }

  async function handleConfirmDelete() {
    // Trips and favorites are both deleted server-side, cascading from the account row.
    await deleteAccount()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-md px-6 py-16">
          {user ? (
            <>
              <div className="text-center">
                <h1 className="text-3xl">{t('account.heading')}</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">{t('account.subheading')}</p>
              </div>

              <Card className="mt-10">
                <form onSubmit={handleNicknameSubmit} noValidate className="space-y-4">
                  <TextField
                    label={t('account.nicknameLabel')}
                    name="nickname"
                    placeholder={t('account.nicknamePlaceholder')}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                  {nicknameMessage ? (
                    <p role="status" className="text-sm text-primary-600 dark:text-primary-400">
                      {nicknameMessage}
                    </p>
                  ) : null}
                  <Button type="submit" variant="primary" size="md" className="w-full">
                    {t('account.saveNicknameButton')}
                  </Button>
                </form>
              </Card>

              <Card className="mt-6">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('auth.emailLabel')}</p>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
              </Card>

              <Card className="mt-6">
                <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
                  <TextField
                    label={t('account.currentPasswordLabel')}
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <TextField
                    label={t('account.newPasswordLabel')}
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <TextField
                    label={t('account.newPasswordConfirmLabel')}
                    name="newPasswordConfirm"
                    type="password"
                    autoComplete="new-password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  />
                  {passwordMessage ? (
                    <p role="status" className="text-sm text-primary-600 dark:text-primary-400">
                      {passwordMessage}
                    </p>
                  ) : null}
                  <Button type="submit" variant="primary" size="md" className="w-full">
                    {t('account.changePasswordButton')}
                  </Button>
                </form>
              </Card>

              <Card className="mt-6 text-center">
                {confirmingDelete ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t('account.confirmDeletePrompt')}
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button variant="ghost" size="md" onClick={() => setConfirmingDelete(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button variant="accent" size="md" onClick={handleConfirmDelete}>
                        {t('account.confirmDeleteButton')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="md" onClick={() => setConfirmingDelete(true)}>
                    {t('account.deleteButton')}
                  </Button>
                )}
              </Card>
            </>
          ) : (
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">{t('account.loginRequired')}</p>
              <div className="mt-6">
                <Button href="/login" variant="primary" size="md">
                  {t('account.goLoginButton')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

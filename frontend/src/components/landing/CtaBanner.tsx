import { Button } from '../ui/Button'
import { useAuth } from '../../context/authContextValue'
import { useLanguage } from '../../context/languageContextValue'

// 랜딩 페이지 하단 가입 유도 배너. 로그인 여부에 따라 "일정 만들기"(기존 사용자) 또는
// "무료로 시작하기"(신규 방문자)로 문구와 링크를 다르게 보여준다.
export function CtaBanner() {
  const { user } = useAuth()
  const { t } = useLanguage()

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <div className="rounded-3xl bg-gradient-to-br from-primary-600 to-ai-600 px-8 py-14 text-center text-white">
        {user ? (
          <>
            <h2 className="text-3xl text-white">{t('landing.ctaLoggedInHeading')}</h2>
            <p className="mt-3 text-primary-50">{t('landing.ctaLoggedInDescription')}</p>
            <div className="mt-8">
              <Button href="/plan/new" variant="accent" size="lg">
                {t('landing.ctaLoggedInButton')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-3xl text-white">{t('landing.ctaAnonymousHeading')}</h2>
            <p className="mt-3 text-primary-50">{t('landing.ctaAnonymousDescription')}</p>
            <div className="mt-8">
              <Button href="/signup" variant="accent" size="lg">
                {t('landing.ctaAnonymousButton')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

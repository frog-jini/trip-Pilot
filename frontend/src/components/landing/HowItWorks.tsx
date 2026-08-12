import { useLanguage } from '../../context/languageContextValue'

// 랜딩 페이지의 "이렇게 완성돼요" 4단계 소개 섹션. 실제 앱 흐름(입력→생성→수정→저장)을
// 그대로 요약한 정적 목록이라 별도 상태나 로직은 없다.
export function HowItWorks() {
  const { t } = useLanguage()

  const steps = [
    { title: t('landing.step1Title'), description: t('landing.step1Description') },
    { title: t('landing.step2Title'), description: t('landing.step2Description') },
    { title: t('landing.step3Title'), description: t('landing.step3Description') },
    { title: t('landing.step4Title'), description: t('landing.step4Description') },
  ]

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-3xl">{t('landing.howItWorksHeading')}</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">{t('landing.howItWorksDescription')}</p>
      </div>

      <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="relative pl-2">
            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-2 text-base">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

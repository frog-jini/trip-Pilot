import { useLanguage } from '../../context/languageContextValue'

// 모든 페이지 하단에 붙는 공통 푸터. 연도는 매번 현재 시각 기준으로 계산해서 하드코딩하지 않는다.
export function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Trailot</p>
        <p>
          &copy; {year} Trailot. {t('common.footerTagline')}
        </p>
      </div>
    </footer>
  )
}

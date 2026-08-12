import { useLanguage } from '../../context/languageContextValue'
import { LANGUAGES } from '../../lib/i18n/language'

// 헤더 맨 오른쪽에 항상 노출되는 언어 전환 버튼 그룹. 로그인 여부와 무관하게 렌더링된다.
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div
      role="group"
      aria-label={t('header.languageSwitcherLabel')}
      className="flex items-center gap-0.5 rounded-full border border-slate-200 p-0.5 dark:border-slate-700"
    >
      {LANGUAGES.map((option) => {
        const selected = option.code === language
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={selected}
            onClick={() => setLanguage(option.code)}
            className={
              selected
                ? 'rounded-full bg-primary-600 px-2 py-1 text-xs font-semibold text-white'
                : 'rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400'
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

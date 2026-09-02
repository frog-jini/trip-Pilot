// Button.tsx와 <a> 링크 버튼(예: Header의 "일정 만들기")이 똑같은 클래스 조합을 쓸 수 있도록
// 스타일 계산 로직만 컴포넌트에서 분리해뒀다.
export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost'
export type ButtonSize = 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700',
  outline:
    'border border-primary-600 text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
}

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

// whitespace-nowrap: 버튼 라벨("일정 만들기" 등)이 좁은 화면에서 flex 형제에 눌려도 글자가
// 세로로 쪼개지지 않고 한 줄을 유지하도록 한다.
const baseClasses =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-50'

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()
}

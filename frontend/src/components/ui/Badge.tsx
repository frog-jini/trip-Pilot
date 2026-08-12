// 작은 알약 모양 라벨(예: "AI 생성 일정"). tone으로 배경/글자색만 바꿔 재사용하는 단순 표시용 컴포넌트.
import type { HTMLAttributes } from 'react'

type Tone = 'neutral' | 'ai' | 'accent'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ai: 'bg-ai-100 text-ai-700 dark:bg-ai-950 dark:text-ai-300',
  accent: 'bg-accent-100 text-accent-700 dark:bg-accent-950 dark:text-accent-300',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  const classes =
    `inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`.trim()

  return <span className={classes} {...props} />
}

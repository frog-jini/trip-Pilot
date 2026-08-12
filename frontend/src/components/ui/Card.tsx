// 테두리·그림자가 있는 흰색(다크모드 시 어두운) 카드 컨테이너. 여러 페이지의 박스 UI가 공유한다.
import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const classes =
    `rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`.trim()

  return <div className={classes} {...props} />
}

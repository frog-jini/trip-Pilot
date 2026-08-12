// label + input + (있으면) 에러 메시지를 한 세트로 묶은 폼 필드. label/error를 접근성 속성
// (htmlFor, aria-invalid, aria-describedby)에 자동으로 연결해줘서 각 폼에서 따로 신경 안 써도 된다.
import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  name: string
  error?: string
}

export function TextField({ label, name, error, className = '', ...props }: TextFieldProps) {
  // name만으로 id를 만들면 같은 화면에 같은 name의 필드가 두 번 있을 때 충돌하니, useId로
  // 인스턴스별 고유 접미사를 붙인다.
  const generatedId = useId()
  const inputId = `${name}-${generatedId}`
  const errorId = `${inputId}-error`

  return (
    <div className="text-left">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white ${
          error
            ? 'border-accent-500 focus:ring-accent-500'
            : 'border-slate-300 dark:border-slate-700'
        } ${className}`.trim()}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-accent-600 dark:text-accent-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}

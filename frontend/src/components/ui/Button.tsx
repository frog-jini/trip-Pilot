// href가 있으면 <a>, 없으면 <button>으로 렌더링되는 공용 버튼. 라우팅 링크와 클릭 액션을
// 똑같은 시각적 스타일로 맞추기 위해 하나의 컴포넌트로 분기 처리한다.
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

type ButtonAsAnchor = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
  }

type ButtonProps = ButtonAsButton | ButtonAsAnchor

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const classes = buttonClasses(variant, size, className)

  if (props.href !== undefined) {
    const { href, ...anchorProps } = props as ButtonAsAnchor
    return (
      <a href={href} className={classes} {...anchorProps}>
        {anchorProps.children}
      </a>
    )
  }

  const buttonProps = props as ButtonAsButton
  return (
    <button type="button" className={classes} {...buttonProps}>
      {buttonProps.children}
    </button>
  )
}

// 랜딩 페이지 등에서 쓰는 단순 라인 아이콘 모음. IconBase가 공통 크기/선굵기/스트로크 스타일을
// 잡아주고, 각 아이콘은 그 안에 들어갈 path만 정의한다.
import type { SVGProps } from 'react'

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
      aria-hidden="true"
      {...props}
    />
  )
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  )
}

export function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v4M12 17v4M4 12h4M16 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
    </IconBase>
  )
}

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M4.5 15a8 8 0 0 0 14.6 2.5M19.5 9a8 8 0 0 0-14.6-2.5" />
    </IconBase>
  )
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 8.5a2.5 2.5 0 1 1 0 5" />
      <path d="M15 14c2.6.4 4.5 2.5 4.5 6" />
    </IconBase>
  )
}

export function BookmarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M6 3.5h12a.5.5 0 0 1 .5.5v16.5l-6.5-4-6.5 4V4a.5.5 0 0 1 .5-.5Z" />
    </IconBase>
  )
}

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4.5 4v-4H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
    </IconBase>
  )
}

export function CloudRainIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M7 16a4.5 4.5 0 0 1 .7-8.94 5.5 5.5 0 0 1 10.6 1.5A4 4 0 0 1 17.5 16H7Z" />
      <path d="M8 19v1M12 19v2M16 19v1" />
    </IconBase>
  )
}

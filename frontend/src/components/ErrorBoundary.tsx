// 화면 어딘가에서 예상 못한 런타임 에러가 나면(예: 응답에 없는 필드를 가정하고 읽는 코드),
// React는 에러 바운더리가 없으면 전체 트리를 그냥 내려버린다 — 사용자 입장에선 "화면이 아예 안
// 뜨는" 새하얀 빈 페이지로 보인다. App.tsx가 라우트 전체를 이걸로 감싸서, 그런 경우에도 최소한
// "문제가 생겼다"는 걸 보여주고 새로고침으로 복구할 수 있게 한다. 에러 자체를 고치는 게
// 아니라 마지막 안전망이라, 특정 언어에 안 묶고 최대한 단순하게 둔다.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the app tree:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-950">
        <p className="text-lg text-slate-900 dark:text-white">문제가 생겼어요. 새로고침해주세요.</p>
        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          홈으로 새로고침
        </button>
      </div>
    )
  }
}

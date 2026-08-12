// 랜딩 페이지의 "#features", "#ai-chat" 같은 앵커 링크(헤더 네비게이션)를 눌렀을 때, 페이지
// 전환 후에도 부드럽게 해당 섹션으로 스크롤되도록 하는 훅. React Router는 해시 변경만으로는
// 브라우저 기본 스크롤을 해주지 않기 때문에 직접 처리한다.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export function useScrollToHash() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return

    const element = document.getElementById(location.hash.slice(1))
    element?.scrollIntoView({ behavior: 'smooth' })
  }, [location.pathname, location.hash])
}

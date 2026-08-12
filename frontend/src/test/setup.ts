// vitest.config.ts의 setupFiles로 모든 테스트 실행 전에 로드된다.
import '@testing-library/jest-dom'

// jsdom엔 scrollIntoView가 구현돼 있지 않다 — ItineraryChat 등이 새 메시지가 오면
// scrollIntoView를 호출하는데, 그게 없으면 테스트가 에러로 죽어버려서 빈 함수로 채워둔다.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

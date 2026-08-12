import { Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { PlanNewPage } from './pages/PlanNewPage'
import { PlanChatPage } from './pages/PlanChatPage'
import { TripsPage } from './pages/TripsPage'
import { TripDetailPage } from './pages/TripDetailPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { CommunityPage } from './pages/CommunityPage'
import { CommunityTripDetailPage } from './pages/CommunityTripDetailPage'
import { AccountPage } from './pages/AccountPage'
import { DestinationSearchPage } from './pages/DestinationSearchPage'
import { useScrollToHash } from './lib/useScrollToHash'

// 전체 라우트 테이블. 로그인 여부에 따른 화면 분기는 각 페이지 컴포넌트 내부(useAuth)에서
// 처리하고, 여기서는 경로 ↔ 페이지 매핑만 담당한다.
export function AppRoutes() {
  // 랜딩 페이지의 "#features" 같은 앵커 링크로 이동했을 때 실제로 그 위치까지 스크롤되도록 한다.
  useScrollToHash()

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/plan/new" element={<PlanNewPage />} />
      <Route path="/plan/chat" element={<PlanChatPage />} />
      <Route path="/trips" element={<TripsPage />} />
      <Route path="/trips/:tripId" element={<TripDetailPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/community" element={<CommunityPage />} />
      <Route path="/community/:tripId" element={<CommunityTripDetailPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/destinations" element={<DestinationSearchPage />} />
    </Routes>
  )
}

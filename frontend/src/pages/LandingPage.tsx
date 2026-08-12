import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Hero } from '../components/landing/Hero'
import { FeatureSection } from '../components/landing/FeatureSection'
import { AiChatShowcase } from '../components/landing/AiChatShowcase'
import { HowItWorks } from '../components/landing/HowItWorks'
import { CommunitySection } from '../components/landing/CommunitySection'
import { CtaBanner } from '../components/landing/CtaBanner'

// "/" 랜딩 페이지. 비로그인 사용자에게 서비스를 소개하는 섹션들을 순서대로 나열만 한다 —
// 각 섹션이 자체 데이터/상태를 갖고 있어서 이 페이지 자체엔 로직이 없다.
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <FeatureSection />
        <AiChatShowcase />
        <HowItWorks />
        <CommunitySection />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  )
}

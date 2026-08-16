import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { InitProgressReport } from '@mlc-ai/web-llm'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Badge } from '../components/ui/Badge'
import { ItineraryChat } from '../components/plan/ItineraryChat'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { createActivityHistory, generatePlan } from '../lib/generatePlan'
import { addTrip } from '../lib/tripsStorage'
import {
  isTripPlanReady,
  nextTripPlanQuestion,
  parseTripPlanMessage,
  parseTripPlanMessageWithAi,
} from '../lib/tripPlanChat'
import { todayIso } from '../lib/dateUtils'
import { emptyTripPlanFormValues, type TripPlanFormValues } from '../lib/tripPlan'
import { isWebGpuSupported, loadEngineWhenSupported, type ChatEngine } from '../lib/aiEngine'
import { reply, type ChatReply } from '../lib/chatReply'

// /plan/chat 화면. 폼 대신 채팅으로 여행 조건(목적지·기간·인원·예산·스타일)을 채워서 일정을 만든다.
// 조건 추출은 항상 규칙 기반 파서(tripPlanChat.ts의 parseTripPlanMessage)가 먼저 시도하고,
// WebGPU를 지원하는 브라우저에서 로컬 LLM이 다 로드됐을 때만 부족한 부분을 AI가 보조로 채운다
// (parseTripPlanMessageWithAi). 서버로 나가는 API 호출은 없다 — 비용도, 개인정보 유출 위험도 없다.

interface PlanChatPageProps {
  // 테스트에서 실제 WebGPU 없이도 가짜 엔진을 주입해 AI 경로를 검증할 수 있도록 기본 구현을
  // prop으로 갈아끼울 수 있게 열어둔다(TripDetailPage도 동일한 패턴을 쓴다).
  loadEngine?: (onProgress?: (report: InitProgressReport) => void) => Promise<ChatEngine>
  isSupported?: () => boolean
  fetchImpl?: typeof fetch
}

export function PlanChatPage({
  loadEngine = loadEngineWhenSupported,
  isSupported = isWebGpuSupported,
  fetchImpl,
}: PlanChatPageProps = {}) {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { t, language } = useLanguage()
  const greeting = t('plan.chatPlanGreeting')
  const [values, setValues] = useState<TripPlanFormValues>(() => ({
    ...emptyTripPlanFormValues,
    startDate: todayIso(),
  }))
  const [engineLoading, setEngineLoading] = useState(() => isSupported())
  const [loadProgressPercent, setLoadProgressPercent] = useState(0)
  const engineRef = useRef<ChatEngine | null>(null)

  useEffect(() => {
    if (!isSupported()) return

    let cancelled = false

    loadEngine((report) => {
      if (!cancelled) setLoadProgressPercent(Math.round(report.progress * 100))
    })
      .then((engine) => {
        if (!cancelled) engineRef.current = engine
      })
      .catch(() => {
        // No AI engine available (unsupported browser or load failure) — the rule-based
        // parser already covers the full flow, so we simply keep using it.
      })
      .finally(() => {
        if (!cancelled) setEngineLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadEngine, isSupported])

  async function handleSendMessage(message: string): Promise<ChatReply> {
    // 엔진이 아직 로딩 중이거나 이 브라우저에서 아예 지원되지 않으면 규칙 기반 파서만 쓴다 —
    // parseTripPlanMessageWithAi 내부적으로도 규칙 기반을 먼저 시도하고 AI는 부족한 값만
    // 채우는 보너스 역할이라, AI가 없어도 기능이 완전히 죽지는 않는다.
    const updated = engineRef.current
      ? await parseTripPlanMessageWithAi(
          message,
          values,
          (messages) => engineRef.current!.complete(messages),
          language,
        )
      : parseTripPlanMessage(message, values, language)
    setValues(updated)

    if (!isTripPlanReady(updated)) {
      const questionKey = nextTripPlanQuestion(updated)
      return reply(questionKey ?? 'plan.chatPlanGreeting')
    }

    const itinerary = generatePlan(updated)
    const history = createActivityHistory(itinerary)
    const trip = await addTrip(token, { itinerary, values: updated, history }, fetchImpl)
    navigate(`/trips/${trip.id}`)

    return reply('plan.chatPlanCompleted')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-xl px-6 py-16">
          <div className="text-center">
            <Badge tone="ai">{t('plan.chatPlanBadge')}</Badge>
            <h1 className="mt-4 text-3xl">{t('plan.chatPlanHeading')}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('plan.chatPlanDescription')}</p>
          </div>

          {engineLoading ? (
            <p role="status" className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {t('plan.chatPlanLoadingStatus', { percent: loadProgressPercent })}
            </p>
          ) : null}

          <div className="mt-10">
            <ItineraryChat
              onSendMessage={handleSendMessage}
              title={t('plan.chatPlanTitle')}
              greeting={greeting}
              placeholder={t('plan.chatPlanPlaceholder')}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

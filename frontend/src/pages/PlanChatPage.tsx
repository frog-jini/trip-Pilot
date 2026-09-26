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
  nextRequiredField,
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
  // 방금 봇이 실제로 물어본 필드가 뭔지 기억해둔다 — 첫 메시지 시점엔 destination이 이미
  // "다음에 채워야 할 필드"라도 아직 그 질문을 콕 집어 던진 적이 없으므로(인사말만 보여줬을 뿐),
  // "값이 안 바뀌었다"만으로 판단하면 첫 메시지부터 오탐(이해 못 했다고 오해)한다.
  const lastAskedFieldRef = useRef<ReturnType<typeof nextRequiredField>>(null)

  useEffect(() => {
    if (!isSupported()) return

    let cancelled = false

    // ↓↓↓ 원복용 원본 코드 (데모 확인 끝나면 아래 TEMP DEMO 블록을 지우고 이 주석만 풀면 됨) ↓↓↓
    // loadEngine((report) => {
    //   if (!cancelled) setLoadProgressPercent(Math.round(report.progress * 100))
    // })
    //   .then((engine) => {
    //     if (!cancelled) engineRef.current = engine
    //   })
    //   .catch(() => {
    //     // 쓸 수 있는 AI 엔진이 없음(지원하지 않는 브라우저이거나 로딩 실패) — 규칙 기반
    //     // 파서가 이미 전체 흐름을 처리하므로 그대로 그걸 쓴다.
    //   })
    //   .finally(() => {
    //     if (!cancelled) setEngineLoading(false)
    //   })
    //
    // return () => {
    //   cancelled = true
    // }
    // ↑↑↑ 원복용 원본 코드 끝 ↑↑↑

    // TEMP DEMO — 캐시 때문에 실제 진행률이 눈 깜빡할 새 0%→100%로 끝나버려서, 화면에 보여주는
    // 숫자만 일부러 1%씩 천천히 올라가게 만든 코드. 확인 끝나면 지울 것.
    let displayedPercent = 0
    let targetPercent = 0
    const rampInterval = setInterval(() => {
      if (cancelled || displayedPercent >= targetPercent) return
      displayedPercent += 1
      setLoadProgressPercent(displayedPercent)
    }, 40)

    loadEngine((report) => {
      targetPercent = Math.round(report.progress * 100)
    })
      .then((engine) => {
        if (!cancelled) engineRef.current = engine
      })
      .catch(() => {
        // 쓸 수 있는 AI 엔진이 없음(지원하지 않는 브라우저이거나 로딩 실패) — 규칙 기반
        // 파서가 이미 전체 흐름을 처리하므로 그대로 그걸 쓴다.
      })
      .finally(() => {
        targetPercent = 100
        const waitForDisplay = setInterval(() => {
          if (cancelled || displayedPercent >= 100) {
            clearInterval(waitForDisplay)
            clearInterval(rampInterval)
            if (!cancelled) setEngineLoading(false)
          }
        }, 50)
      })

    return () => {
      cancelled = true
      clearInterval(rampInterval)
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
      // 방금 물어본 필드의 답을 이해하지 못해 그 필드 값이 그대로면(스타일뿐 아니라 목적지/인원/예산도
      // 마찬가지) nextTripPlanQuestion()이 같은 질문을 무한 반복하게 된다 — 사용자 입장에선 봇이
      // 멈춘 것처럼 보이므로, 이 경우엔 "이해 못 했다"는 걸 알려주는 별도 문구로 답한다.
      const pendingField = nextRequiredField(values)
      const wasAskedAboutPendingField = pendingField !== null && pendingField === lastAskedFieldRef.current
      const pendingFieldUnchanged =
        wasAskedAboutPendingField &&
        (Array.isArray(values[pendingField])
          ? (values[pendingField] as unknown[]).length === (updated[pendingField] as unknown[]).length
          : values[pendingField] === updated[pendingField])
      // "2일차에는 디즈니랜드 포함해서 계획 세워줘" 같은 메시지는 지금 물어보던 필드(예: 인원)를
      // 전혀 건드리지 않아 pendingFieldUnchanged가 true가 되지만, dayMustVisit은 분명히 늘었으니
      // "이해 못 했다"고 답하면 안 된다 — 이럴 땐 이해한 것으로 보고 다음 질문으로 넘어간다.
      const dayMustVisitChanged = JSON.stringify(values.dayMustVisit) !== JSON.stringify(updated.dayMustVisit)
      if (pendingFieldUnchanged && !dayMustVisitChanged) {
        return reply(pendingField === 'styles' ? 'plan.chatPlanStyleNotRecognized' : 'plan.chatPlanFieldNotRecognized')
      }

      lastAskedFieldRef.current = nextRequiredField(updated)
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

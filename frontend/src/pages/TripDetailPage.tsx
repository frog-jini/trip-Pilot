import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { InitProgressReport } from '@mlc-ai/web-llm'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Button } from '../components/ui/Button'
import { ItineraryResult } from '../components/plan/ItineraryResult'
import { ItineraryChat } from '../components/plan/ItineraryChat'
import {
  addActivity,
  addDay,
  addNamedActivity,
  applyWeatherAdjustment,
  createActivityHistory,
  generatePlan,
  getSwapOptions,
  removeActivity,
  selectActivity,
  type ActivityHistory,
} from '../lib/generatePlan'
import { deleteTrip, getTrip, updateTrip, type SavedTrip } from '../lib/tripsStorage'
import type { TripItinerary } from '../lib/tripPlan'
import { useAuth } from '../context/authContextValue'
import { useLanguage } from '../context/languageContextValue'
import { addFavorite, isFavorited, readFavorites, removeFavorite, type FavoritePlace } from '../lib/favoritesStorage'
import { parseAddActivityIntent, parseRemoveActivityIntent, parseWeatherIntent, type WeatherKeyword } from '../lib/chatIntent'
import { setActivityCost } from '../lib/activityCost'
import { setActivityTime } from '../lib/activityTime'
import { getMyPublishedTrip, publishTrip, unpublishTrip, updateCommunityTrip } from '../lib/communityTrips'
import { fetchDailyForecast as fetchDailyForecastDefault, type DailyForecast } from '../lib/weather'
import { isWebGpuSupported, loadEngineWhenSupported, type ChatCompletionMessage, type ChatEngine } from '../lib/aiEngine'
import { resolveTripChatActionWithAi } from '../lib/tripChatAction'
import { reply, type ChatReply } from '../lib/chatReply'

const WEATHER_LABEL_KEYS: Record<WeatherKeyword, string> = {
  rain: 'tripDetail.weatherRain',
  snow: 'tripDetail.weatherSnow',
  storm: 'tripDetail.weatherStorm',
  dust: 'tripDetail.weatherDust',
  heat: 'tripDetail.weatherHeat',
  cold: 'tripDetail.weatherCold',
  clear: 'tripDetail.weatherClear',
  outdoor: 'tripDetail.weatherOutdoor',
}

interface TripDetailPageProps {
  fetchDailyForecast?: (startDate: string, days: number) => Promise<DailyForecast[]>
  fetchImpl?: typeof fetch
  // PlanChatPage와 동일한 주입 패턴 — 테스트에서 진짜 WebGPU 없이도 가짜 엔진을 넣어
  // AI 경로를 검증할 수 있게, 그리고 브라우저 지원 여부도 실제 navigator.gpu 대신 갈아끼울 수 있게.
  loadEngine?: (onProgress?: (report: InitProgressReport) => void) => Promise<ChatEngine>
  isSupported?: () => boolean
}

export function TripDetailPage({
  fetchDailyForecast = fetchDailyForecastDefault,
  fetchImpl,
  loadEngine = loadEngineWhenSupported,
  isSupported = isWebGpuSupported,
}: TripDetailPageProps = {}) {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { t, language } = useLanguage()
  const [trip, setTrip] = useState<SavedTrip | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<FavoritePlace[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [forecasts, setForecasts] = useState<Record<string, DailyForecast>>({})
  const [communityTripId, setCommunityTripId] = useState<string | null>(null)
  const [communityTag, setCommunityTag] = useState<string | null>(null)
  // 로컬 LLM 인스턴스는 리렌더와 무관하게 유지되면 되므로 ref로 들고 있는다(PlanChatPage와 동일).
  const engineRef = useRef<ChatEngine | null>(null)
  // 정규식이 못 잡는 자유로운 문장을 AI가 해석할 때, 이전 턴들을 함께 보내 맥락을 잇는다.
  // 최근 몇 턴만 유지해서 프롬프트가 무한정 길어지지 않게 한다.
  const chatHistoryRef = useRef<ChatCompletionMessage[]>([])
  // 모델을 내려받는 동안(수백MB, 몇 초~몇 분) 사용자가 "왜 자꾸 패턴을 못 알아듣지" 하고
  // 오해하지 않도록, PlanChatPage와 똑같이 진행률을 화면에 보여준다. isSupported()가 false면
  // 애초에 로딩을 시작하지 않으니 처음부터 false로 시작한다.
  const [engineLoading, setEngineLoading] = useState(() => isSupported())
  const [loadProgressPercent, setLoadProgressPercent] = useState(0)

  useEffect(() => {
    if (!isSupported()) return

    let cancelled = false

    loadEngine((report) => {
      if (!cancelled) setLoadProgressPercent(Math.round(report.progress * 100))
    })
      .then(
        (engine) => {
          if (!cancelled) engineRef.current = engine
        },
        () => {
          // 지원하지 않는 브라우저이거나 모델 로드에 실패한 경우 — 정규식 기반 채팅으로도
          // 날씨/추가/삭제는 이미 전부 커버되므로 조용히 그대로 둔다.
        },
      )
      .finally(() => {
        if (!cancelled) setEngineLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadEngine, isSupported])

  useEffect(() => {
    let cancelled = false
    // 다른 일정으로 이동하면 이전 일정 얘기가 AI 프롬프트에 섞여 들어가지 않도록 대화 맥락을 비운다.
    chatHistoryRef.current = []

    const request = tripId ? getTrip(token, tripId, fetchImpl) : Promise.resolve(null)
    request.then(async (result) => {
      if (cancelled) return
      setTrip(result)
      const published = result ? await getMyPublishedTrip(token, result.id, fetchImpl) : null
      if (cancelled) return
      setCommunityTripId(published?.id ?? null)
      setCommunityTag(published?.tag ?? null)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [tripId, token, fetchImpl])

  useEffect(() => {
    let cancelled = false
    readFavorites(token, fetchImpl).then((result) => {
      if (!cancelled) setFavorites(result)
    })
    return () => {
      cancelled = true
    }
  }, [token, fetchImpl])

  const startDate = trip?.itinerary.days[0]?.date
  const dayCount = trip?.itinerary.days.length

  useEffect(() => {
    if (!startDate || !dayCount) {
      return
    }

    let cancelled = false

    fetchDailyForecast(startDate, dayCount)
      .then((results) => {
        if (cancelled) return
        setForecasts(Object.fromEntries(results.map((forecast) => [forecast.date, forecast])))
      })
      .catch(() => {
        if (!cancelled) setForecasts({})
      })

    return () => {
      cancelled = true
    }
  }, [startDate, dayCount, fetchDailyForecast])

  // A published trip's community post holds its own itinerary snapshot, so any handler
  // below that changes trip.itinerary must push that change through to keep it in sync.
  //
  // updateTrip()은 costs/times를 넘기지 않으면 빈 값으로 덮어쓴다(백엔드 PUT이 그렇게 동작함).
  // 그래서 itinerary/history만 바뀌는 이 핸들러들도 현재 trip.costs·trip.times를 항상 함께
  // 실어 보내야 한다 — 안 그러면 활동 삭제·추가 같은 조작을 할 때마다 이미 입력해둔 비용과
  // 시간이 조용히 사라져버린다.
  async function persistTripUpdate(patch: { itinerary: TripItinerary; history: ActivityHistory }) {
    if (!trip) return null
    const updated = await updateTrip(
      token,
      trip.id,
      { ...patch, costs: trip.costs, times: trip.times },
      fetchImpl,
    )
    if (updated) setTrip(updated)
    if (communityTripId && communityTag) {
      await updateCommunityTrip(token, communityTripId, communityTag, fetchImpl)
    }
    return updated
  }

  async function handleRemoveActivity(day: number, activity: string) {
    if (!trip) return

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, addedActivity, history } = removeActivity(
      trip.itinerary,
      trip.values,
      day,
      activity,
      currentHistory,
    )
    await persistTripUpdate({ itinerary: nextItinerary, history })

    setNotice(
      addedActivity
        ? t('tripDetail.noticeRemovedWithReplacement', { activity, added: addedActivity })
        : t('tripDetail.noticeRemoved', { activity }),
    )
  }

  async function handleSwapActivity(day: number, oldActivity: string, newActivity: string) {
    if (!trip) return

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, history } = selectActivity(
      trip.itinerary,
      day,
      oldActivity,
      newActivity,
      currentHistory,
    )
    await persistTripUpdate({ itinerary: nextItinerary, history })

    setNotice(t('tripDetail.noticeSwapped', { oldActivity, newActivity }))
  }

  async function handleEditActivity(day: number, oldActivity: string, newActivity: string) {
    if (!trip) return

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, history } = selectActivity(
      trip.itinerary,
      day,
      oldActivity,
      newActivity,
      currentHistory,
    )
    await persistTripUpdate({ itinerary: nextItinerary, history })

    setNotice(t('tripDetail.noticeEdited', { oldActivity, newActivity }))
  }

  function resolveSwapOptions(activity: string, _day: number): string[] {
    if (!trip) return []
    // 교체 후보에서 "지금 일정의 모든 날에 이미 있는 장소"를 빼서, 다른 날과 겹치는 곳을 추천하지 않는다.
    const placed = trip.itinerary.days.flatMap((d) => d.activities)
    return getSwapOptions(trip.itinerary.destination, activity, placed)
  }

  async function handleAddDay() {
    if (!trip) return

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, history } = addDay(trip.itinerary, trip.values, currentHistory)
    await persistTripUpdate({ itinerary: nextItinerary, history })

    setNotice(t('tripDetail.noticeDayAdded', { n: nextItinerary.days.length }))
  }

  async function handleAddActivity(day: number) {
    if (!trip) return

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, addedActivity, history, reachedDailyLimit } = addActivity(
      trip.itinerary,
      trip.values,
      day,
      currentHistory,
    )
    await persistTripUpdate({ itinerary: nextItinerary, history })

    if (addedActivity) {
      setNotice(t('tripDetail.noticeActivityAdded', { day, activity: addedActivity }))
    } else if (reachedDailyLimit) {
      setNotice(t('tripDetail.noticeDayFullShort', { day }))
    } else {
      setNotice(t('tripDetail.noticeNoMoreSuggestions', { day }))
    }
  }

  async function handleSetActivityCost(day: number, activity: string, amountWon: number) {
    if (!trip) return

    const nextCosts = setActivityCost(trip.costs, day, activity, amountWon)
    const updated = await updateTrip(
      token,
      trip.id,
      { itinerary: trip.itinerary, history: trip.history, costs: nextCosts, times: trip.times },
      fetchImpl,
    )
    if (updated) setTrip(updated)
  }

  async function handleSetActivityTime(day: number, activity: string, time: string) {
    if (!trip) return

    const nextTimes = setActivityTime(trip.times, day, activity, time)
    const updated = await updateTrip(
      token,
      trip.id,
      { itinerary: trip.itinerary, history: trip.history, costs: trip.costs, times: nextTimes },
      fetchImpl,
    )
    if (updated) setTrip(updated)
  }

  async function handleTogglePublish() {
    if (!trip) return

    if (communityTripId) {
      await unpublishTrip(token, communityTripId, fetchImpl)
      setCommunityTripId(null)
      setCommunityTag(null)
      setNotice(t('tripDetail.unpublishedNotice'))
    } else {
      const published = await publishTrip(token, trip.id, trip.values.styles[0] ?? '나만의 여행', fetchImpl)
      setCommunityTripId(published.id)
      setCommunityTag(published.tag)
      setNotice(t('tripDetail.publishedNotice'))
    }
  }

  async function handleToggleFavorite(activity: string) {
    if (!trip) return
    const place = { destination: trip.itinerary.destination, activity }

    if (isFavorited(favorites, place)) {
      const target = favorites.find((f) => f.destination === place.destination && f.activity === activity)
      if (!target) return
      await removeFavorite(token, target.id, fetchImpl)
      setFavorites((current) => current.filter((f) => f.id !== target.id))
    } else {
      const created = await addFavorite(token, place, fetchImpl)
      setFavorites((current) => [...current, created])
    }
  }

  async function handleConfirmDelete() {
    if (!trip) return
    await deleteTrip(token, trip.id, fetchImpl)
    navigate('/trips')
  }

  const CLARIFICATION_MESSAGE = reply('tripDetail.clarificationMessage')

  // 아래 세 applyXxx 함수는 "무엇을 할지"가 정해진 다음 실제로 일정을 바꾸는 부분이다.
  // 정규식으로 바로 알아낸 경우와, 아래쪽에서 AI가 구조화된 행동(TripChatAction)으로 해석해준
  // 경우가 똑같은 실행 로직을 타도록 공유해서, 두 경로의 동작이 어긋나지 않게 한다.

  async function applyAddActivity(day: number, activity: string): Promise<ChatReply> {
    if (!trip) return reply('tripDetail.tripUnavailable')

    const dayExists = trip.itinerary.days.some((d) => d.day === day)
    if (!dayExists) {
      return reply('tripDetail.dayNotInTrip', { day, max: trip.itinerary.days.length })
    }

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, history, reachedDailyLimit } = addNamedActivity(
      trip.itinerary,
      day,
      activity,
      currentHistory,
    )

    if (reachedDailyLimit) {
      return reply('tripDetail.chatDayFull', { day })
    }

    await persistTripUpdate({ itinerary: nextItinerary, history })
    return reply('tripDetail.noticeActivityAdded', { day, activity })
  }

  // ✕ 버튼(handleRemoveActivity)과 똑같이 removeActivity()를 재사용해서, 지운 자리에
  // AI가 대체 활동을 자동으로 추천해주는 동작까지 그대로 이어받는다.
  async function applyRemoveActivity(day: number, activity: string): Promise<ChatReply> {
    if (!trip) return reply('tripDetail.tripUnavailable')

    const targetDay = trip.itinerary.days.find((d) => d.day === day)
    if (!targetDay) {
      return reply('tripDetail.dayNotInTrip', { day, max: trip.itinerary.days.length })
    }
    if (!targetDay.activities.includes(activity)) {
      return reply('tripDetail.chatActivityNotFound', { day, activity })
    }

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, addedActivity, history } = removeActivity(
      trip.itinerary,
      trip.values,
      day,
      activity,
      currentHistory,
    )
    await persistTripUpdate({ itinerary: nextItinerary, history })

    return addedActivity
      ? reply('tripDetail.chatRemovedWithReplacement', { day, activity, added: addedActivity })
      : reply('tripDetail.chatRemoved', { day, activity })
  }

  async function applyWeatherAction(day: number, weather: WeatherKeyword): Promise<ChatReply> {
    if (!trip) return reply('tripDetail.tripUnavailable')

    const dayExists = trip.itinerary.days.some((d) => d.day === day)
    if (!dayExists) {
      return reply('tripDetail.dayNotInTrip', { day, max: trip.itinerary.days.length })
    }

    // weatherWord는 날씨 자체도 t()로 번역되는 문구라, 미리 문자열로 굳히지 않고 렌더링 시점의
    // t()로 다시 풀어야 언어를 바꿨을 때 이 안쪽 단어까지 함께 새 언어로 바뀐다.
    if (weather === 'clear') {
      return (translate) => translate('tripDetail.chatWeatherClear', { day, weather: translate(WEATHER_LABEL_KEYS[weather]) })
    }

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)

    if (weather === 'outdoor') {
      const originalDay = generatePlan(trip.values).days.find((d) => d.day === day)
      if (!originalDay) {
        return reply('tripDetail.dayNotInTrip', { day, max: trip.itinerary.days.length })
      }

      const days = trip.itinerary.days.map((d) =>
        d.day === day ? { ...d, activities: originalDay.activities } : d,
      )
      const nextItinerary = { ...trip.itinerary, days }
      await persistTripUpdate({ itinerary: nextItinerary, history: currentHistory })

      return (translate) =>
        translate('tripDetail.chatWeatherOutdoorRestored', { day, weather: translate(WEATHER_LABEL_KEYS[weather]) })
    }

    const { itinerary: nextItinerary, history, changed } = applyWeatherAdjustment(
      trip.itinerary,
      day,
      currentHistory,
    )

    if (!changed) {
      return reply('tripDetail.chatWeatherAlreadyIndoor', { day })
    }

    await persistTripUpdate({ itinerary: nextItinerary, history })

    return (translate) => translate('tripDetail.chatWeatherAdjusted', { day, weather: translate(WEATHER_LABEL_KEYS[weather]) })
  }

  /**
   * 1) 정규식 파서(빠르고 100% 예측 가능)를 먼저 시도하고,
   * 2) 셋 다 매치되지 않았고 로컬 LLM이 로드돼 있으면, 지금까지의 대화 맥락 + 현재 일정을 함께
   *    보내 자유로운 문장("그럼 거기다 디즈니랜드도 넣어줘")을 구조화된 행동으로 해석시킨다,
   * 3) 그래도 알아낸 게 없으면 안내 문구로 되돌아간다.
   * 실제 일정 변경은 항상 위의 applyXxx가 맡으므로, AI가 이상한 값을 내도 실행 단계에서
   * 유효성 검사(일차 존재 여부, 활동 존재 여부 등)를 다시 거친다.
   */
  async function resolveChatReply(message: string): Promise<ChatReply> {
    if (!trip) return reply('tripDetail.tripUnavailable')

    const addIntent = parseAddActivityIntent(message, language)
    if (addIntent.day !== null && addIntent.activity) {
      return applyAddActivity(addIntent.day, addIntent.activity)
    }

    const removeIntent = parseRemoveActivityIntent(message, language)
    if (removeIntent.day !== null && removeIntent.activity) {
      return applyRemoveActivity(removeIntent.day, removeIntent.activity)
    }

    const weatherIntent = parseWeatherIntent(message, language)
    if (weatherIntent.day !== null && weatherIntent.weather !== null) {
      return applyWeatherAction(weatherIntent.day, weatherIntent.weather)
    }

    const engine = engineRef.current
    if (engine) {
      const action = await resolveTripChatActionWithAi(
        message,
        trip.itinerary,
        chatHistoryRef.current,
        (messages) => engine.complete(messages),
      )

      if (action.action === 'add_activity') return applyAddActivity(action.day, action.activity)
      if (action.action === 'remove_activity') return applyRemoveActivity(action.day, action.activity)
      if (action.action === 'weather') return applyWeatherAction(action.day, action.weather)
    }

    return CLARIFICATION_MESSAGE
  }

  // 대화 맥락을 몇 턴이나 프롬프트에 남길지 — 너무 길면 로컬 모델 추론이 느려지므로
  // 최근 4턴(사용자+AI 합쳐 8개 메시지)만 유지한다.
  const CHAT_HISTORY_TURNS_TO_KEEP = 8

  async function handleChatMessage(message: string): Promise<ChatReply> {
    if (!trip) return reply('tripDetail.tripUnavailable')

    const priorMessages = chatHistoryRef.current
    const chatReply = await resolveChatReply(message)
    // AI에게 넘길 대화 맥락은 그 턴에 실제로 화면에 보여준 문장의 스냅샷이면 충분하다 —
    // 이후 언어를 바꿔도 이 기록 자체를 다시 번역할 필요는 없다(그 목적은 오직 pronoun 참조
    // 해석을 위한 참고 맥락이라, 화면에 보이는 과거 메시지 재번역과는 별개다).
    const chatReplyText = chatReply(t)

    chatHistoryRef.current = [
      ...priorMessages,
      { role: 'user' as const, content: message },
      { role: 'assistant' as const, content: chatReplyText },
    ].slice(-CHAT_HISTORY_TURNS_TO_KEEP)

    return chatReply
  }

  const favoriteActivities = trip
    ? favorites.filter((f) => f.destination === trip.itinerary.destination).map((f) => f.activity)
    : []

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {/* trip 로딩 여부와 무관하게(엔진이 먼저 끝날 수도 있으므로) 항상 이 위치에서 관리한다. */}
          {engineLoading ? (
            <p role="status" className="mb-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {t('plan.chatPlanLoadingStatus', { percent: loadProgressPercent })}
            </p>
          ) : null}

          {loading ? (
            <p role="status" className="text-center text-sm text-slate-500 dark:text-slate-400">
              {t('tripDetail.loadingStatus')}
            </p>
          ) : trip ? (
            <>
              {notice ? (
                <p
                  role="status"
                  className="mb-6 rounded-xl bg-ai-100 px-4 py-3 text-center text-sm text-ai-700 dark:bg-ai-950 dark:text-ai-300"
                >
                  {notice}
                </p>
              ) : null}

              <ItineraryResult
                itinerary={trip.itinerary}
                onRemoveActivity={handleRemoveActivity}
                onToggleFavorite={handleToggleFavorite}
                favoriteActivities={favoriteActivities}
                onSwapActivity={handleSwapActivity}
                getSwapOptions={resolveSwapOptions}
                onEditActivity={handleEditActivity}
                forecastsByDate={forecasts}
                onAddDay={handleAddDay}
                onAddActivity={handleAddActivity}
                costs={trip.costs}
                onSetActivityCost={handleSetActivityCost}
                times={trip.times}
                onSetActivityTime={handleSetActivityTime}
              />

              <div className="mt-6">
                <ItineraryChat
                  onSendMessage={handleChatMessage}
                  title={t('tripDetail.chatTitle')}
                  greeting={t('tripDetail.chatGreeting')}
                  placeholder={t('tripDetail.chatPlaceholder')}
                />
              </div>

              <div className="mt-10 border-t border-slate-200 pt-6 text-center dark:border-slate-800">
                <Button variant="outline" size="md" onClick={handleTogglePublish}>
                  {communityTripId ? t('tripDetail.unpublish') : t('tripDetail.publish')}
                </Button>
              </div>

              <div className="mt-6 text-center">
                {confirmingDelete ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t('tripDetail.confirmDeletePrompt')}
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button variant="ghost" size="md" onClick={() => setConfirmingDelete(false)}>
                        {t('common.cancel')}
                      </Button>
                      <Button variant="accent" size="md" onClick={handleConfirmDelete}>
                        {t('tripDetail.confirmDeleteButton')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="md" onClick={() => setConfirmingDelete(true)}>
                    {t('tripDetail.deleteButton')}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">{t('tripDetail.notFound')}</p>
              <div className="mt-6">
                <Button href="/trips" variant="primary" size="md">
                  {t('tripDetail.backToTrips')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

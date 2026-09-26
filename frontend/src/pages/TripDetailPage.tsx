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
  findMatchingActivity,
  findRecommendations,
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
import {
  hasWeatherKeyword,
  parseAddActivityIntent,
  parseRecommendIntent,
  parseRemoveActivityIntent,
  parseWeatherIntent,
  type WeatherKeyword,
} from '../lib/chatIntent'
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

// "일차만 먼저 말했다"/"활동명만 먼저 말했다"처럼 add/remove/weather 세 의도 중 하나가 아직 덜
// 채워진 채로 다음 턴을 기다리는 상태 하나를 표현한다. kind별로 필요한 두 번째 조각(activity 또는
// weather)이 다르므로 태그드 유니온으로 둔다.
type PendingChatAction =
  | { kind: 'add'; day: number | null; activity: string | null }
  | { kind: 'remove'; day: number | null; activity: string | null }
  | { kind: 'weather'; day: number | null; weather: WeatherKeyword | null }

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
  // add/remove/weather 챗은 각자 필요한 조각(일차+활동명, 또는 일차+날씨)을 한 메시지에 같이
  // 말해야만 바로 실행된다. 사용자가 "2일차"나 "디즈니랜드 삭제해줘"처럼 한쪽만 먼저 말하면 이번
  // 턴만으로는 실행할 수 없지만, 그렇다고 아예 못 알아들은 척 일반 안내문으로 돌아가면 "방금 한
  // 말이 무시됐다"는 인상을 준다 — 그래서 이미 알아낸 조각을 다음 턴까지 기억해뒀다가, 나머지
  // 조각이 오면 합쳐서 실행한다. PlanChatPage의 lastAskedFieldRef와 같은 취지(봇이 같은 질문을
  // 무한 반복하지 않기)다.
  //
  // 원래는 날씨 전용(pendingWeatherIntentRef)이었는데, add/remove가 활동명만 먼저 말하고 일차를
  // 나중에 말하는 흔한 패턴에서 그 조각을 통째로 버리고 있었다. 게다가 parseWeatherIntent의 day
  // 추출은 날씨 키워드 게이트가 없어서, 그렇게 버려진 삭제 요청에 대한 답으로 "2일차"라고만 말해도
  // 무조건 날씨 대기 정보로 잘못 흡수돼버리는 회귀가 있었다(신고된 버그: "디즈니랜드 삭제해줘" →
  // "2일차" 가 삭제 실행 대신 "어떤 날씨예요?"로 이어짐). 그래서 세 의도를 모두 표현할 수 있는
  // 하나의 pending으로 일반화했다 — 자세한 처리는 resolveChatReply 참고.
  const pendingChatActionRef = useRef<PendingChatAction | null>(null)
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

  // 게시된 여행의 커뮤니티 글은 일정의 사본을 따로 갖고 있다. 그래서 아래에서 trip.itinerary를
  // 바꾸는 핸들러는 모두 그 변경을 커뮤니티 글에도 반영해 동기화를 유지해야 한다.
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

    // 카탈로그 활동은 "이름 (지역)"으로 저장되는데(generatePlan.ts의 getStylePool 참고), 사용자는
    // 지역 없이 짧은 이름만 말하는 경우가 많다 — 그래서 정확히 일치하지 않으면 느슨한 매처로
    // 실제 저장된 이름을 찾는다. 이후 삭제 실행과 응답 문구 모두 그 실제 이름을 쓴다 — 그래야
    // 사용자가 자기가 말한 짧은 이름이 아니라 실제로 뭐가 지워졌는지 정확히 확인할 수 있다.
    const matched = findMatchingActivity(targetDay.activities, activity)
    if (!matched) {
      // 지정한 날엔 없지만 다른 날엔 있을 수 있다(며칠차인지 착각한 경우) — 이때는 무작정
      // "없다"고 답하는 대신 실제로 어느 날에 있는지 알려줘서 다시 정확한 날짜로 물어보게 한다.
      // 실수로 지우는 걸 막기 위해 여기서 자동으로 지우지는 않는다.
      for (const otherDay of trip.itinerary.days) {
        if (otherDay.day === day) continue
        const matchedElsewhere = findMatchingActivity(otherDay.activities, activity)
        if (matchedElsewhere) {
          return reply('tripDetail.chatActivityOnOtherDay', { day, activity: matchedElsewhere, actualDay: otherDay.day })
        }
      }
      return reply('tripDetail.chatActivityNotFound', { day, activity })
    }

    const currentHistory = trip.history ?? createActivityHistory(trip.itinerary)
    const { itinerary: nextItinerary, addedActivity, history } = removeActivity(
      trip.itinerary,
      trip.values,
      day,
      matched,
      currentHistory,
    )
    await persistTripUpdate({ itinerary: nextItinerary, history })

    return addedActivity
      ? reply('tripDetail.chatRemovedWithReplacement', { day, activity: matched, added: addedActivity })
      : reply('tripDetail.chatRemoved', { day, activity: matched })
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

  // add/remove/weather와 달리 일정을 바꾸지 않는 순수 안내 응답이다 — "추천해줘"는 사용자가 아직
  // 아무것도 확정하지 않은 요청이라, 여기서 바로 일정에 반영하는 대신 후보만 말해주고 사용자가
  // "2일차에 그거 추가해줘"처럼 add 플로우로 자연스럽게 이어가게 한다.
  async function applyRecommend(day: number | null): Promise<ChatReply> {
    if (!trip) return reply('tripDetail.tripUnavailable')

    const { styles } = trip.values
    // 스타일을 하나도 안 골랐으면 후보 풀 자체가 없으니, 후보를 못 찾은 경우와 같은 안내로 수렴한다.
    const placed = trip.itinerary.days.flatMap((d) => d.activities)
    const suggestions = styles.length > 0 ? findRecommendations(styles, trip.itinerary.destination, placed, 2) : []

    if (suggestions.length === 0) {
      return reply('tripDetail.chatRecommendNothingNew')
    }

    const activities = suggestions.join(', ')
    return day !== null
      ? reply('tripDetail.chatRecommendForDay', { day, activities })
      : reply('tripDetail.chatRecommend', { activities })
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
      // 다른 의도가 확정됐으니, 남아있던 부분 정보가 이후의 엉뚱한 메시지와 잘못 합쳐지지
      // 않도록 비운다.
      pendingChatActionRef.current = null
      return applyAddActivity(addIntent.day, addIntent.activity)
    }

    const removeIntent = parseRemoveActivityIntent(message, language)
    if (removeIntent.day !== null && removeIntent.activity) {
      pendingChatActionRef.current = null
      return applyRemoveActivity(removeIntent.day, removeIntent.activity)
    }

    // parseWeatherIntent().day는 게이트 없이(=키워드가 없어도) 뽑히지만, .weather는 실제 날씨
    // 단어가 있어야만 채워진다 — 그래서 "이번 메시지가 날씨 얘기였는지"는 weatherIntent.day가
    // 아니라 반드시 hasWeatherKeyword로만 판단해야 한다. 이 구분이 바로 신고된 회귀의 핵심
    // 수정점이다: "2일차"처럼 일차 숫자만 있고 날씨 단어가 없는 메시지를 날씨 의도로 단정하지 않는다.
    const weatherIntent = parseWeatherIntent(message, language)
    const weatherKeywordPresent = hasWeatherKeyword(message, language)

    // add가 "키워드는 있었지만(추가/넣어/포함 등) 일차나 활동명 중 하나가 빠진" 부분 정보를
    // 줬다면, 이전 턴에 남겨둔 같은 종류(add)의 부분 정보와 합친다. 합쳐서 완성되면 바로
    // 실행하고, 아직 모자라면 그 조각을 기억해뒀다가 부족한 쪽을 되물어본다 — 예전엔 이 정보를
    // 그냥 버리고 일반 안내문으로 돌아가서 "방금 한 말이 무시됐다"는 인상을 줬다.
    if (addIntent.day !== null || addIntent.activity !== null) {
      const previous = pendingChatActionRef.current
      const carried = previous?.kind === 'add' ? previous : null
      const day = addIntent.day ?? carried?.day ?? null
      const activity = addIntent.activity ?? carried?.activity ?? null

      if (day !== null && activity) {
        pendingChatActionRef.current = null
        return applyAddActivity(day, activity)
      }

      pendingChatActionRef.current = { kind: 'add', day, activity }
      if (day === null && activity) return reply('tripDetail.clarificationNeedDayForAdd', { activity })
      if (day !== null && !activity) return reply('tripDetail.clarificationNeedActivityForAdd', { day })
      // 위 if 조건(day !== null || activity !== null) 때문에 이론상 도달하지 않지만, 타입
      // 안전을 위해 방어적으로 일반 안내문으로 돌아간다.
      return CLARIFICATION_MESSAGE
    }

    // remove도 add와 동일한 방식으로 부분 정보를 기억했다가 합쳐서 완성한다.
    if (removeIntent.day !== null || removeIntent.activity !== null) {
      const previous = pendingChatActionRef.current
      const carried = previous?.kind === 'remove' ? previous : null
      const day = removeIntent.day ?? carried?.day ?? null
      const activity = removeIntent.activity ?? carried?.activity ?? null

      if (day !== null && activity) {
        pendingChatActionRef.current = null
        return applyRemoveActivity(day, activity)
      }

      pendingChatActionRef.current = { kind: 'remove', day, activity }
      if (day === null && activity) return reply('tripDetail.clarificationNeedDayForRemove', { activity })
      if (day !== null && !activity) return reply('tripDetail.clarificationNeedActivityForRemove', { day })
      return CLARIFICATION_MESSAGE
    }

    // 날씨도 마찬가지지만, 반드시 weatherKeywordPresent가 참일 때만("비/눈/폭염..." 같은 실제
    // 날씨 단어가 이번 메시지에 있었을 때만) 날씨 의도로 다룬다 — 그래야 날씨 단어 없이 일차만
    // 말한 메시지가 여기서 날씨로 잘못 흡수되지 않는다(바로 아래 "일차만 말한 경우" 처리로 넘어감).
    if (weatherKeywordPresent && (weatherIntent.day !== null || weatherIntent.weather !== null)) {
      const previous = pendingChatActionRef.current
      const carried = previous?.kind === 'weather' ? previous : null
      const day = weatherIntent.day ?? carried?.day ?? null
      const weather = weatherIntent.weather ?? carried?.weather ?? null

      if (day !== null && weather !== null) {
        pendingChatActionRef.current = null
        return applyWeatherAction(day, weather)
      }

      pendingChatActionRef.current = { kind: 'weather', day, weather }
      if (day === null && weather !== null) {
        return (translate) =>
          translate('tripDetail.clarificationNeedDay', { weather: translate(WEATHER_LABEL_KEYS[weather]) })
      }
      if (day !== null && weather === null) {
        return reply('tripDetail.clarificationNeedWeather', { day })
      }
      return CLARIFICATION_MESSAGE
    }

    // "추천해줘"류는 add/remove/weather 키워드와 겹치지 않아 항상 위의 세 체크를 그대로 통과해
    // 여기 도달한다. add/remove와 달리 일차 없이도(day: null) 그 자체로 완성된 요청이라 pending으로
    // 나눠 기억할 필요가 없고, 날씨 의도처럼 "일차 숫자만 있어도 날씨로 짐작"하는 아래쪽 bareDay
    // 로직보다 반드시 먼저 처리해야 한다 — 안 그러면 "2일차에 뭐 넣을지 추천해줘"가 날씨 숫자만
    // 뽑혀서 "어떤 날씨예요?"로 잘못 흡수된다(신고된 버그의 연장선). AI 폴백보다도 앞서 처리해서,
    // 로컬 LLM이 이 요청을 weather로 잘못 추측할 기회 자체를 주지 않는다.
    const recommendIntent = parseRecommendIntent(message, language)
    if (recommendIntent) {
      pendingChatActionRef.current = null
      return applyRecommend(recommendIntent.day)
    }

    // 여기까지 왔다면 이번 메시지엔 add/remove/weather 중 어느 것에도 키워드 신호가 없었다는
    // 뜻이다. 그래도 "2일차"처럼 순수하게 일차 숫자만 말했을 수 있는데, 이미 대기 중인 부분
    // 정보(pendingChatActionRef)가 있다면 그건 곧 "그 요청에 대한 답"이므로 종류를 가리지 않고
    // day 칸을 채운다 — 예전엔 날씨만 이렇게 이어받고 add/remove로 남겨둔 활동명은 그냥 버려서,
    // "디즈니랜드 삭제해줘"(활동명만 옴) 다음에 "2일차"라고 답해도 그 활동명을 잊어버린 채
    // 엉뚱하게 "어떤 날씨예요?"라고 되묻는 회귀가 있었다(신고된 버그의 핵심 원인). 이 완성 판단은
    // 이미 알고 있는 정보를 이어붙이는 것뿐이라 애매함이 없으므로, AI 시도보다 먼저 처리한다.
    const bareDay = weatherIntent.day
    const pending = pendingChatActionRef.current
    if (bareDay !== null && pending) {
      if (pending.kind === 'weather') {
        if (pending.weather !== null) {
          pendingChatActionRef.current = null
          return applyWeatherAction(bareDay, pending.weather)
        }
        pendingChatActionRef.current = { ...pending, day: bareDay }
        return reply('tripDetail.clarificationNeedWeather', { day: bareDay })
      }

      if (pending.activity) {
        const applyPending = pending.kind === 'add' ? applyAddActivity : applyRemoveActivity
        pendingChatActionRef.current = null
        return applyPending(bareDay, pending.activity)
      }

      pendingChatActionRef.current = { ...pending, day: bareDay }
      return pending.kind === 'add'
        ? reply('tripDetail.clarificationNeedActivityForAdd', { day: bareDay })
        : reply('tripDetail.clarificationNeedActivityForRemove', { day: bareDay })
    }

    const engine = engineRef.current
    if (engine) {
      const action = await resolveTripChatActionWithAi(
        message,
        trip.itinerary,
        chatHistoryRef.current,
        (messages) => engine.complete(messages),
      )

      if (action.action === 'add_activity') {
        pendingChatActionRef.current = null
        return applyAddActivity(action.day, action.activity)
      }
      if (action.action === 'remove_activity') {
        pendingChatActionRef.current = null
        return applyRemoveActivity(action.day, action.activity)
      }
      if (action.action === 'weather') {
        pendingChatActionRef.current = null
        return applyWeatherAction(action.day, action.weather)
      }
      if (action.action === 'recommend') {
        pendingChatActionRef.current = null
        return applyRecommend(action.day)
      }
    }

    // AI까지 확인해봤지만(또는 애초에 로드돼 있지 않아서) 이 메시지로 다른 행동을 결정하지
    // 못했다 — 이때만 "일차만 말했다"를 진짜 진전으로 보고 날씨 의도의 부분 정보로 남긴다(이
    // 판단을 AI 시도보다 먼저 해버리면, "2일차에 그것도 넣어줘" 같이 우연히 일차 숫자가 들어있을
    // 뿐 실제로는 AI가 풀어야 할 자유로운 문장까지 여기서 가로채 "날씨가 뭐예요?" 라고 엉뚱하게
    // 되묻게 된다). 위의 pending 완성 분기와 달리 여기 도달했다는 건 대기 중이던 정보가 전혀
    // 없었다는 뜻이라, 그 자체로 무엇에 대한 답인지 알 수 없는 "맨 일차 숫자"뿐이다 — 그래도 이
    // 채팅이 애초에 날씨/추가/삭제만 다루는 화면이니, 날씨 의도로 짐작해 되묻는 쪽이 아무 반응도
    // 없는 것보단 낫다는 기존 판단을 그대로 유지한다.
    if (bareDay !== null) {
      pendingChatActionRef.current = { kind: 'weather', day: bareDay, weather: null }
      return reply('tripDetail.clarificationNeedWeather', { day: bareDay })
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

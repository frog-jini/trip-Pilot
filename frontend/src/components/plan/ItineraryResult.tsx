// 일정표를 실제로 그리는 컴포넌트. onXxx 콜백들이 전부 optional인 이유는, 이 컴포넌트가
// "읽기 전용 미리보기"(콜백 없음)와 "완전히 편집 가능한 상세 화면"(TripDetailPage, 콜백 전부 전달)
// 양쪽에서 재사용되기 때문 — 각 편집 버튼/입력창은 대응하는 콜백이 있을 때만 렌더링된다.
import { useState } from 'react'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/languageContextValue'
import { formatItineraryDate } from '../../lib/dateUtils'
import { getGoogleMapsSearchUrl } from '../../lib/googleMaps'
import { isBeforeNextMidnight, scheduleDay } from '../../lib/scheduleTime'
import { formatForecastSummary, type DailyForecast } from '../../lib/weather'
import { formatWon, getBudgetSummary, getDayTotal, type ActivityCosts } from '../../lib/activityCost'
import type { ActivityTimes } from '../../lib/activityTime'
import { DURATION_LABEL_KEYS, type TripItinerary } from '../../lib/tripPlan'
import { translateActivityLabel } from '../../lib/activityTranslation'
import { translateDestinationName } from '../../lib/destinationTranslation'

interface ItineraryResultProps {
  itinerary: TripItinerary
  onRemoveActivity?: (day: number, activity: string) => void
  onToggleFavorite?: (activity: string) => void
  favoriteActivities?: string[]
  onSwapActivity?: (day: number, oldActivity: string, newActivity: string) => void
  getSwapOptions?: (activity: string, day: number) => string[]
  onEditActivity?: (day: number, oldActivity: string, newActivity: string) => void
  forecastsByDate?: Record<string, DailyForecast>
  onAddDay?: () => void
  onAddActivity?: (day: number) => void
  costs?: ActivityCosts
  onSetActivityCost?: (day: number, activity: string, amountWon: number) => void
  // 사용자가 지정한 활동별 시간(없으면 scheduleTime.ts가 자동 계산). onSetActivityTime이
  // 있을 때만 편집 가능한 입력창으로 보여주고, 없으면 기존처럼 텍스트로만 표시한다.
  times?: ActivityTimes
  onSetActivityTime?: (day: number, activity: string, time: string) => void
}

export function ItineraryResult({
  itinerary,
  onRemoveActivity,
  onToggleFavorite,
  favoriteActivities = [],
  onSwapActivity,
  getSwapOptions,
  onEditActivity,
  forecastsByDate = {},
  onAddDay,
  onAddActivity,
  costs = {},
  onSetActivityCost,
  times = {},
  onSetActivityTime,
}: ItineraryResultProps) {
  const { t, language } = useLanguage()
  const budgetSummary = getBudgetSummary(itinerary, costs)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState('')

  // expandedKey/editingKey는 "day:인덱스" 형태의 키 하나만 기억한다 — 한 번에 활동 하나만
  // 옵션 펼치기/직접수정 상태로 둘 수 있으면 충분하고, 굳이 세트로 관리할 필요가 없기 때문.
  function startEditing(key: string, activity: string) {
    setEditingKey(key)
    setDraftValue(activity)
  }

  function saveEdit(day: number, activity: string) {
    const trimmed = draftValue.trim()
    if (trimmed) onEditActivity?.(day, activity, trimmed)
    setEditingKey(null)
  }

  return (
    <div>
      <div className="text-center">
        <Badge tone="ai">{t('plan.aiGeneratedItinerary')}</Badge>
        <h1 className="mt-4 text-3xl">
          {translateDestinationName(itinerary.destination, language)} {t(DURATION_LABEL_KEYS[itinerary.duration])}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t('plan.travelersAndBudget', { travelers: itinerary.travelers, budget: itinerary.budget })}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="font-medium text-slate-700 dark:text-slate-300">{t('plan.budgetStatusTitle')}</p>
        <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
          {itinerary.days.map((day) => (
            <li key={day.day}>
              {t('plan.dayUsed', {
                title: t('common.dayLabel', { n: day.day }),
                amount: formatWon(getDayTotal(day, costs[day.day])),
              })}
            </li>
          ))}
        </ul>
        <p
          className={`mt-3 border-t border-slate-200 pt-3 font-semibold dark:border-slate-800 ${
            budgetSummary.isOverBudget
              ? 'text-accent-600 dark:text-accent-400'
              : 'text-slate-800 dark:text-white'
          }`}
        >
          {budgetSummary.isOverBudget
            ? t('plan.totalSpentOverBudget', {
                spent: formatWon(budgetSummary.spentWon),
                over: formatWon(-budgetSummary.remainingWon),
              })
            : t('plan.totalSpentWithinBudget', {
                spent: formatWon(budgetSummary.spentWon),
                budget: formatWon(budgetSummary.budgetWon),
                remaining: formatWon(budgetSummary.remainingWon),
              })}
        </p>
      </div>

      <div className="mt-10 space-y-4">
        {itinerary.days.map((day) => {
          const dayTitle = t('common.dayLabel', { n: day.day })
          return (
          <Card key={day.day}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-base text-primary-700 dark:text-primary-400">{dayTitle}</h3>
              {day.date ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatItineraryDate(day.date)}
                </span>
              ) : null}
            </div>
            {day.date && forecastsByDate[day.date] ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatForecastSummary(forecastsByDate[day.date], t)}
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {/* scheduleDay가 활동 배열 자체는 안 건드리고, 화면에 붙일 시간·식사 라벨만 계산해준다.
                  times[day.day]로 사용자가 직접 지정한 시간이 있으면 자동 계산 대신 그 값을 쓴다. */}
              {scheduleDay(day.activities, itinerary.destination, times[day.day] ?? {}).map(({ time, activity, mealLabel }, activityIndex) => {
                const displayActivity = translateActivityLabel(activity, itinerary.destination, language)
                const isFavorite = favoriteActivities.includes(activity)
                const key = `${day.day}:${activityIndex}`
                const swapOptions = getSwapOptions ? getSwapOptions(activity, day.day) : []
                const isExpanded = expandedKey === key
                const isEditing = editingKey === key
                const dayCosts = costs[day.day] ?? {}

                if (isEditing) {
                  return (
                    <li
                      key={key}
                      className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={t('plan.editInputAria', { activity: displayActivity })}
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => saveEdit(day.day, activity)}
                          className="shrink-0 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingKey(null)}
                          className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </li>
                  )
                }

                return (
                  <li
                    key={key}
                    className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="shrink-0 font-medium text-primary-600 dark:text-primary-400">
                          {onSetActivityTime ? (
                            <input
                              type="time"
                              aria-label={t('plan.timeInputAria', { activity: displayActivity })}
                              value={time}
                              onChange={(e) => onSetActivityTime(day.day, activity, e.target.value)}
                              className="w-[6.5rem] rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                          ) : (
                            time
                          )}
                          {mealLabel ? (
                            <span className="text-accent-600 dark:text-accent-400">
                              {' '}
                              · <span>{t(mealLabel === 'lunch' ? 'common.mealLunch' : 'common.mealDinner')}</span>
                            </span>
                          ) : null}
                        </span>
                        {displayActivity}
                        {onSetActivityCost ? (
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <input
                              type="number"
                              min={0}
                              aria-label={t('plan.costInputAria', { activity: displayActivity })}
                              value={dayCosts[activity] ?? ''}
                              placeholder="0"
                              onChange={(e) =>
                                onSetActivityCost(day.day, activity, Number(e.target.value) || 0)
                              }
                              className="w-16 rounded-md border border-slate-300 px-1.5 py-0.5 text-right text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                            원
                          </span>
                        ) : null}
                        <a
                          href={getGoogleMapsSearchUrl(itinerary.destination, activity)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t('plan.mapLinkAria', { activity: displayActivity })}
                          className="text-slate-400 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          📍
                        </a>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {onSwapActivity && swapOptions.length > 0 ? (
                          <button
                            type="button"
                            aria-label={t('plan.swapOptionsAria', { activity: displayActivity })}
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedKey(isExpanded ? null : key)}
                            className="text-slate-400 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            ⇄
                          </button>
                        ) : null}
                        {onEditActivity ? (
                          <button
                            type="button"
                            aria-label={t('plan.editActivityAria', { activity: displayActivity })}
                            onClick={() => startEditing(key, activity)}
                            className="text-slate-400 transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                          >
                            ✎
                          </button>
                        ) : null}
                        {onToggleFavorite ? (
                          <button
                            type="button"
                            aria-label={t(
                              isFavorite ? 'plan.toggleFavoriteAriaRemove' : 'plan.toggleFavoriteAriaAdd',
                              { activity: displayActivity },
                            )}
                            aria-pressed={isFavorite}
                            onClick={() => onToggleFavorite(activity)}
                            className={
                              isFavorite
                                ? 'text-accent-500'
                                : 'text-slate-300 transition-colors hover:text-accent-400 dark:text-slate-600'
                            }
                          >
                            ★
                          </button>
                        ) : null}
                        {onRemoveActivity ? (
                          <button
                            type="button"
                            aria-label={t('plan.removeActivityAria', { activity: displayActivity })}
                            onClick={() => onRemoveActivity(day.day, activity)}
                            className="text-slate-400 transition-colors hover:text-accent-600 dark:hover:text-accent-400"
                          >
                            ✕
                          </button>
                        ) : null}
                      </span>
                    </div>

                    {isExpanded ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {swapOptions.map((option) => {
                          const displayOption = translateActivityLabel(option, itinerary.destination, language)
                          return (
                          <button
                            key={option}
                            type="button"
                            aria-label={t('plan.selectOptionAria', { option: displayOption })}
                            onClick={() => {
                              onSwapActivity?.(day.day, activity, option)
                              setExpandedKey(null)
                            }}
                            className="rounded-full border border-primary-300 bg-white px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:border-primary-700 dark:bg-slate-900 dark:text-primary-300 dark:hover:bg-primary-950"
                          >
                            {displayOption}
                          </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            {onAddActivity ? (
              (() => {
                // 다음 활동이 배정될 시간대가 자정을 넘기면(scheduleTime.ts 기준) 더 못 넣게 막고,
                // 버튼 문구도 바꿔서 "왜 못 누르는지" 바로 알 수 있게 한다.
                const dayIsFull = !isBeforeNextMidnight(day.activities.length)
                return (
                  <div className="mt-3 text-center">
                    <Button
                      variant="ghost"
                      size="md"
                      disabled={dayIsFull}
                      aria-label={
                        dayIsFull
                          ? t('plan.dayFullAria', { title: dayTitle })
                          : t('plan.addActivityAria', { title: dayTitle })
                      }
                      onClick={() => onAddActivity(day.day)}
                    >
                      {dayIsFull ? t('plan.dayFullButton') : t('plan.addActivityButton')}
                    </Button>
                  </div>
                )
              })()
            ) : null}
          </Card>
          )
        })}
      </div>

      {onAddDay ? (
        <div className="mt-6 text-center">
          <Button variant="outline" size="md" onClick={onAddDay}>
            {t('plan.addDayButton')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

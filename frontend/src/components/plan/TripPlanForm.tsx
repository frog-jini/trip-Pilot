// 일정 생성 조건(목적지·기간·인원·예산·스타일 등)을 입력받는 폼. 제출 시점의 값 검증만 하고
// 실제 일정 생성(generatePlan)은 부모(PlanNewPage)가 onSubmit으로 받은 값을 가지고 처리한다.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/languageContextValue'
import { todayIso } from '../../lib/dateUtils'
import { mergeFavoritesIntoMustVisit, type FavoritePlace } from '../../lib/favoritesStorage'
import {
  DURATION_LABEL_KEYS,
  DURATION_OPTIONS,
  STYLE_LABEL_KEYS,
  STYLE_OPTIONS,
  emptyTripPlanFormValues,
  type TravelStyle,
  type TripPlanFormValues,
} from '../../lib/tripPlan'
import { validateTripPlanForm, type TripPlanFormErrors } from '../../lib/tripPlanValidation'

interface TripPlanFormProps {
  onSubmit: (values: TripPlanFormValues) => void
  initialValues?: Partial<TripPlanFormValues>
  favorites?: FavoritePlace[]
}

export function TripPlanForm({ onSubmit, initialValues, favorites = [] }: TripPlanFormProps) {
  const { t } = useLanguage()
  const [values, setValues] = useState<TripPlanFormValues>(() => {
    const base: TripPlanFormValues = {
      ...emptyTripPlanFormValues,
      startDate: todayIso(),
      ...initialValues,
    }
    return base.destination
      ? { ...base, mustVisit: mergeFavoritesIntoMustVisit(base.mustVisit, base.destination, favorites) }
      : base
  })
  const [errors, setErrors] = useState<TripPlanFormErrors>({})
  const durationId = useId()
  const mustVisitId = useId()

  // The initial destination's favorites may still be loading (fetched async by the parent)
  // when this form first mounts — catch up once they arrive, but only once.
  const initialDestination = initialValues?.destination
  const hasAppliedInitialFavorites = useRef(false)
  useEffect(() => {
    if (!initialDestination || hasAppliedInitialFavorites.current || favorites.length === 0) return
    hasAppliedInitialFavorites.current = true
    setValues((prev) => ({
      ...prev,
      mustVisit: mergeFavoritesIntoMustVisit(prev.mustVisit, initialDestination, favorites),
    }))
  }, [favorites, initialDestination])

  function toggleStyle(style: TravelStyle) {
    setValues((prev) => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter((s) => s !== style)
        : [...prev.styles, style],
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateTripPlanForm(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length === 0) {
      onSubmit(values)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <TextField
        label={t('plan.formDestinationLabel')}
        name="destination"
        placeholder={t('plan.formDestinationPlaceholder')}
        value={values.destination}
        error={errors.destination ? t(errors.destination) : undefined}
        onChange={(e) => setValues((prev) => ({ ...prev, destination: e.target.value }))}
        // 매 키 입력마다가 아니라 입력을 마치고 포커스를 벗어날 때 한 번만 병합한다 — 목적지를
        // 다 타이핑하기 전에 이전 글자만으로 즐겨찾기를 잘못 매칭해 병합하는 걸 막기 위함.
        onBlur={() => {
          if (!values.destination) return
          setValues((prev) => ({
            ...prev,
            mustVisit: mergeFavoritesIntoMustVisit(prev.mustVisit, prev.destination, favorites),
          }))
        }}
      />

      <TextField
        label={t('plan.formStartDateLabel')}
        name="startDate"
        type="date"
        error={errors.startDate ? t(errors.startDate) : undefined}
        value={values.startDate}
        onChange={(e) => setValues((prev) => ({ ...prev, startDate: e.target.value }))}
      />

      <div className="text-left">
        <label htmlFor={durationId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('plan.formDurationLabel')}
        </label>
        <select
          id={durationId}
          value={values.duration}
          onChange={(e) =>
            setValues((prev) => ({ ...prev, duration: e.target.value as TripPlanFormValues['duration'] }))
          }
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {DURATION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(DURATION_LABEL_KEYS[option])}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t('plan.formTravelersLabel')}
          name="travelers"
          type="number"
          min={1}
          placeholder={t('plan.formTravelersPlaceholder')}
          value={values.travelers}
          error={errors.travelers ? t(errors.travelers) : undefined}
          onChange={(e) => setValues((prev) => ({ ...prev, travelers: e.target.value }))}
        />

        <TextField
          label={t('plan.formBudgetLabel')}
          name="budget"
          type="number"
          min={0}
          placeholder={t('plan.formBudgetPlaceholder')}
          value={values.budget}
          error={errors.budget ? t(errors.budget) : undefined}
          onChange={(e) => setValues((prev) => ({ ...prev, budget: e.target.value }))}
        />
      </div>

      <TextField
        label={t('plan.formAccommodationLabel')}
        name="accommodation"
        placeholder={t('plan.formAccommodationPlaceholder')}
        value={values.accommodation}
        onChange={(e) => setValues((prev) => ({ ...prev, accommodation: e.target.value }))}
      />

      <div className="text-left">
        <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('plan.formStyleLabel')}
        </span>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((style) => {
            const selected = values.styles.includes(style)
            return (
              <button
                key={style}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleStyle(style)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:border-primary-400 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {t(STYLE_LABEL_KEYS[style])}
              </button>
            )
          })}
        </div>
        {errors.styles ? (
          <p role="alert" className="mt-1.5 text-sm text-accent-600 dark:text-accent-400">
            {t(errors.styles)}
          </p>
        ) : null}
      </div>

      <div className="text-left">
        <label htmlFor={mustVisitId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('plan.formMustVisitLabel')}
        </label>
        <textarea
          id={mustVisitId}
          rows={3}
          placeholder={t('plan.formMustVisitPlaceholder')}
          value={values.mustVisit}
          onChange={(e) => setValues((prev) => ({ ...prev, mustVisit: e.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full">
        {t('plan.formSubmit')}
      </Button>
    </form>
  )
}

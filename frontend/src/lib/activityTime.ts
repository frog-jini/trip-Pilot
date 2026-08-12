// 활동별로 사용자가 직접 지정한 시간을 다루는 함수 모음. activityCost.ts와 같은 구조를 쓴다:
// day -> activity명 -> 값 형태의 맵이며, 값이 비어 있으면 자동 계산된 시간(scheduleTime.ts)이 대신 쓰인다.
export type DayTimes = Record<string, string>
export type ActivityTimes = Record<number, DayTimes>

/** 특정 일자·활동의 시간을 저장/수정한다. 빈 문자열을 넘기면 해당 항목을 지워서 자동 계산 시간으로 되돌린다. */
export function setActivityTime(
  times: ActivityTimes,
  day: number,
  activity: string,
  time: string,
): ActivityTimes {
  const dayTimes = { ...(times[day] ?? {}) }

  if (time) {
    dayTimes[activity] = time
  } else {
    delete dayTimes[activity]
  }

  return { ...times, [day]: dayTimes }
}

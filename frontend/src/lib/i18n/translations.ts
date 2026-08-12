// 모든 네임스페이스별 사전을 하나로 모으고, "namespace.key" 형태의 점(dot) 경로로 문자열을
// 찾아주는 곳. 새 화면을 번역할 땐 dictionaries/ 아래 파일을 새로 추가하고 여기 dictionaries에
// 한 줄만 등록하면 된다.
import type { Language } from './language'
import { headerDictionary } from './dictionaries/header'
import { landingDictionary } from './dictionaries/landing'
import { authDictionary } from './dictionaries/auth'
import { commonDictionary } from './dictionaries/common'
import { planDictionary } from './dictionaries/plan'
import { tripDetailDictionary } from './dictionaries/tripDetail'
import { tripsDictionary } from './dictionaries/trips'
import { favoritesDictionary } from './dictionaries/favorites'
import { accountDictionary } from './dictionaries/account'
import { communityDictionary } from './dictionaries/community'
import { destinationsDictionary } from './dictionaries/destinations'

const dictionaries: Record<string, Record<Language, Record<string, string>>> = {
  header: headerDictionary,
  landing: landingDictionary,
  auth: authDictionary,
  common: commonDictionary,
  plan: planDictionary,
  tripDetail: tripDetailDictionary,
  trips: tripsDictionary,
  favorites: favoritesDictionary,
  account: accountDictionary,
  community: communityDictionary,
  destinations: destinationsDictionary,
}

// "{{name}}" 형태의 자리표시자를 params 값으로 바꿔치기한다. params가 없거나 해당 자리표시자가
// params에 없으면 그 부분은 원문 그대로 남겨둔다("이거 번역 안에 값을 안 채웠구나"가 눈에 띄도록).
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
    template,
  )
}

// namespace나 entry가 없으면(오타, 아직 번역 안 한 화면 등) 예외를 던지는 대신 key 자체를
// 돌려준다 — 화면이 깨지는 대신 "번역 안 됨"이 눈에 띄는 형태로 그대로 보이는 쪽을 택했다.
export function translate(language: Language, key: string, params?: Record<string, string | number>): string {
  const [namespace, ...rest] = key.split('.')
  const entryKey = rest.join('.')
  const dictionary = dictionaries[namespace]
  const template = dictionary ? (dictionary[language]?.[entryKey] ?? dictionary.ko[entryKey] ?? key) : key

  return interpolate(template, params)
}

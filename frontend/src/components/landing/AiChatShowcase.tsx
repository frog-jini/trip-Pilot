import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useLanguage } from '../../context/languageContextValue'
import { ChatIcon, CloudRainIcon, SparklesIcon } from '../ui/icons'

// 랜딩 페이지(#ai-chat)에서 "날씨 챗" 기능을 소개하는 섹션. 아래 채팅 버블은 실제 동작이 아니라
// TripDetailPage의 날씨 채팅 흐름을 미리 보여주기 위한 정적 목업이다.
export function AiChatShowcase() {
  const { t } = useLanguage()

  return (
    <section id="ai-chat" className="bg-ai-50 py-20 dark:bg-ai-950/30">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
        <div>
          <Badge tone="ai">{t('landing.aiChatBadge')}</Badge>
          <h2 className="mt-4 text-3xl">{t('landing.aiChatHeading')}</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">{t('landing.aiChatDescription')}</p>

          <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <ChatIcon className="size-5 text-ai-600 dark:text-ai-400" />
              {t('landing.aiChatBullet1')}
            </li>
            <li className="flex items-center gap-2">
              <SparklesIcon className="size-5 text-ai-600 dark:text-ai-400" />
              {t('landing.aiChatBullet2')}
            </li>
          </ul>

          <div className="mt-8">
            <Button href="/plan/chat" variant="primary" size="lg">
              {t('landing.aiChatButton')}
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-ai-200 bg-white p-5 shadow-sm dark:border-ai-900 dark:bg-slate-900">
          <div className="ml-auto flex max-w-[85%] items-start gap-2">
            <p className="rounded-2xl rounded-tr-sm bg-primary-600 px-4 py-2.5 text-sm text-white">
              {t('landing.aiChatSampleUser')}
            </p>
            <CloudRainIcon className="mt-1 size-5 shrink-0 text-primary-500" />
          </div>

          <div className="flex max-w-[85%] items-start gap-2">
            <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-ai-600 text-white">
              <SparklesIcon className="size-3.5" />
            </span>
            <p className="rounded-2xl rounded-tl-sm bg-ai-100 px-4 py-2.5 text-sm text-ai-800 dark:bg-ai-900 dark:text-ai-100">
              {t('landing.aiChatSampleAi')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

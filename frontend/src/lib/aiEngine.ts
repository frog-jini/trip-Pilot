// 브라우저 안에서 직접 돌아가는 로컬 LLM(WebLLM)을 로드하고 감싸는 모듈. 서버로 나가는 API
// 호출이 전혀 없다 — 모델 다운로드도, 추론도 전부 사용자 브라우저 안에서 일어난다(비용 없음).
// WebGPU를 지원하지 않는 브라우저에서는 아예 로드를 시도하지 않고, 호출부는 항상 정규식 기반
// 대체 로직을 갖고 있어야 한다(예: chatIntent.ts, tripPlanChat.ts).
import type { InitProgressReport } from '@mlc-ai/web-llm'

export interface ChatCompletionMessage {
  // 'assistant'는 여러 턴에 걸친 대화(예: 일정 상세의 채팅형 AI 수정)에서 이전 AI 응답을
  // 프롬프트에 그대로 되돌려 넣어 맥락을 이어가기 위해 필요하다 — 단발성 추출(예: 여행 조건
  // 파싱)에서는 'system'/'user'만으로 충분했지만, 대화 맥락을 기억하려면 필수다.
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatEngine {
  complete(messages: ChatCompletionMessage[]): Promise<string>
}

// 이 프로젝트가 쓰는 모델은 Qwen2.5-1.5B-Instruct 하나로 고정한다 — WebLLM이 지원하는 소형
// instruct 모델 중 다운로드 용량이 가장 작아, 이 프로젝트 전역의 1초 AI 타임아웃(tripChatAction.ts,
// tripPlanChat.ts)에 가장 잘 맞고, 한국어를 포함한 다국어 이해력도 동급 모델 중 상대적으로 강하다.
const PREFERRED_MODEL_NAME = 'Qwen2.5-1.5B-Instruct'

// modelList는 WebLLM이 지원하는 전체 모델 목록(prebuiltAppConfig.model_list)이다. 위 모델이
// 없는 경우(향후 WebLLM 버전에서 목록이 바뀌는 경우 대비)에만 첫 번째 모델로 폴백해서 "아예 못 씀"
// 대신 "덜 최적화된 모델이라도 씀"을 택한다.
export function pickModelId(modelList: { model_id: string }[]): string {
  const match = modelList.find((model) => model.model_id.includes(PREFERRED_MODEL_NAME))
  return match?.model_id ?? modelList[0]?.model_id ?? ''
}

/** navigator.gpu 존재 여부만 확인한다 — 실제로 어댑터를 요청해보는 것까지는 하지 않는다
 *  (요청 자체가 비동기라 이 동기 함수의 용도에 안 맞고, 실패는 로딩 단계에서 자연히 걸러진다). */
export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

let enginePromise: Promise<ChatEngine> | null = null

/**
 * Loads (and caches) the in-browser LLM engine. Not unit-testable here: it requires a
 * real WebGPU-capable browser to download and run the model, which this test environment
 * (Node/jsdom, no GPU) cannot provide. Verified against WebLLM's documented API instead.
 */
export function loadWebLlmEngine(onProgress?: (report: InitProgressReport) => void): Promise<ChatEngine> {
  if (!enginePromise) {
    // Dynamically imported so the (large) model-runtime library is only ever downloaded
    // by users who actually open the AI chat, instead of bloating every page's bundle.
    enginePromise = import('@mlc-ai/web-llm')
      .then(({ CreateMLCEngine, prebuiltAppConfig }) => {
        const modelId = pickModelId(prebuiltAppConfig.model_list)
        return CreateMLCEngine(modelId, { initProgressCallback: onProgress })
      })
      .then((engine) => ({
        async complete(messages: ChatCompletionMessage[]) {
          // response_format을 json_object로 고정한다 — 이 엔진을 쓰는 호출부(tripPlanChat.ts,
          // tripChatAction.ts)가 전부 모델 응답을 JSON으로 파싱하기 때문에, 모델이 설명 문장을
          // 섞어 보내는 걸 애초에 차단한다.
          const reply = await engine.chat.completions.create({
            messages,
            response_format: { type: 'json_object' },
          })
          return reply.choices[0]?.message?.content ?? ''
        },
      }))
  }
  return enginePromise
}

/** Skips loading entirely on browsers without WebGPU, instead of letting the load fail. */
export function loadEngineWhenSupported(onProgress?: (report: InitProgressReport) => void): Promise<ChatEngine> {
  if (!isWebGpuSupported()) {
    return Promise.reject(new Error('WebGPU is not supported in this browser'))
  }
  return loadWebLlmEngine(onProgress)
}

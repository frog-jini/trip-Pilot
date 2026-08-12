// aiEngine.ts 중 순수 함수인 pickModelId만 테스트한다 — 실제 모델 로딩/추론(loadWebLlmEngine)은
// 진짜 WebGPU 브라우저가 있어야 해서 이 환경(Node/jsdom)에서는 테스트할 수 없다.
import { pickModelId } from './aiEngine'

describe('pickModelId', () => {
  it('picks the preferred model regardless of its position in the list', () => {
    const models = [
      { model_id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC' },
      { model_id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' },
    ]
    expect(pickModelId(models)).toBe('Qwen2.5-1.5B-Instruct-q4f16_1-MLC')
  })

  it('falls back to the first available model when the preferred model is not found', () => {
    const models = [{ model_id: 'some-other-model-q4f16_1-MLC' }, { model_id: 'yet-another-model' }]
    expect(pickModelId(models)).toBe('some-other-model-q4f16_1-MLC')
  })

  it('returns an empty string when the model list is empty', () => {
    expect(pickModelId([])).toBe('')
  })
})

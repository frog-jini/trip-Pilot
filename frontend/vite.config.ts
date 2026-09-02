/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // 로컬 .env.local에 실제 구글/카카오 키가 들어있어도, 테스트는 jsdom에서 진짜 외부 SDK
    // 스크립트를 불러올 수 없다(네트워크 요청이 끝내 응답하지 않음) — 그래서 테스트에서는 항상
    // "설정 안 됨" 상태로 고정해, 각 소셜 로그인 버튼이 커스텀 데모 버튼으로 즉시(타임아웃
    // 대기 없이) 대체되게 한다.
    env: {
      VITE_GOOGLE_CLIENT_ID: '',
      VITE_KAKAO_JS_KEY: '',
    },
  },
})

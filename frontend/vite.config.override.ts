import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: '/tmp/claude-1000/-home-jini-trip-Pilot/6035d852-d06f-4124-8610-b7076410af3b/scratchpad/vite-cache',
})

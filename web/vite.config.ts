import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // 8010 — чтобы не конфликтовать с другими локальными сервисами на :8000
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
})

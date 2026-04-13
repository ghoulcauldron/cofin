import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// cache bust: 2026-04-13
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
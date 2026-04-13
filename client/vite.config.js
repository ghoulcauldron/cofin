import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// cache bust: 2026-04-13b
export default defineConfig({
  plugins: [react()],
  define: {
    // Hardcode public Supabase values — these are intentionally public
    // (they ship in the browser bundle regardless of how they're set)
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || 'https://mroznpukkyhsilqqvkqp.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY || ''
    ),
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'https://cofin-server-production.up.railway.app/api'
    ),
  },
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
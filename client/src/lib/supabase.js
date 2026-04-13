import { createClient } from '@supabase/supabase-js'

// These public values are intentionally hardcoded — the Supabase URL and anon key
// are designed to be public and ship in the browser bundle regardless.
// The service role key (server-only) is never exposed here.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mroznpukkyhsilqqvkqp.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3pucHVra3loc2lscXF2a3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzgwODcsImV4cCI6MjA5MDkxNDA4N30.AW3ud-J_1Dzr2pTc1PcaBjZz92wnu51VShwRzVN-47k'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── API helper ────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || 'https://cofin-server-production.up.railway.app/api'

async function request(path, options = {}) {
  const session = (await supabase.auth.getSession()).data.session
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),

  upload: async (path, formData) => {
    const session = (await supabase.auth.getSession()).data.session
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: formData
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data
  }
}
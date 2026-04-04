import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth.js'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const signIn = useAuthStore(s => s.signIn)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)', padding:24
    }}>
      <div style={{ width:'100%', maxWidth:380 }} className="animate-fadeUp">
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontFamily:'var(--serif)', fontSize:36, color:'var(--accent)', letterSpacing:'-1px' }}>cofin</div>
          <div style={{ fontSize:12, color:'var(--muted)', letterSpacing:'2px', textTransform:'uppercase', marginTop:4 }}>your money, together</div>
        </div>

        <div className="card-lg" style={{ padding:32 }}>
          <h2 style={{ fontFamily:'var(--serif)', fontSize:20, marginBottom:24, fontWeight:400 }}>Sign in</h2>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label className="input-label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="input-label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ fontSize:13, color:'var(--danger)', padding:'10px 14px', background:'rgba(196,112,90,0.1)', borderRadius:8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width:'100%', justifyContent:'center', marginTop:8, padding:'12px 18px', fontSize:14 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', fontSize:12, color:'var(--subtle)', marginTop:24 }}>
          First time? Create your account via Supabase or ask your partner to invite you.
        </p>
      </div>
    </div>
  )
}

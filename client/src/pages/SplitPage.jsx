import { useState, useEffect } from 'react'
import { api } from '../lib/supabase.js'
import { useAuthStore } from '../stores/auth.js'
import { format } from 'date-fns'

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(Math.abs(n))
}

export default function SplitPage() {
  const { user } = useAuthStore()
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [settling, setSettling] = useState(false)
  const [settled, setSettled] = useState(false)
  const [notes, setNotes] = useState('')

  async function load() {
    try {
      const [bal, hist] = await Promise.all([
        api.get('/split/balance'),
        api.get('/split/history')
      ])
      setBalance(bal)
      setHistory(hist)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSettle() {
    const owesEntry = balance?.balances?.find(b => b.owes > 0)
    if (!owesEntry) return
    setSettling(true)
    try {
      await api.post('/split/settle', {
        amount: owesEntry.owes,
        notes,
        settlerName: user?.user_metadata?.name || 'Your partner'
      })
      setSettled(true)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSettling(false)
    }
  }

  const owesEntry = balance?.balances?.find(b => b.owes > 0)
  const totalJoint = balance?.total || 0
  const fair = balance?.fair || 0

  return (
    <div style={{ padding:'24px 20px', maxWidth:700, margin:'0 auto' }}>
      <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px', marginBottom:4 }}>Split tracker</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:28 }}>Unsettled joint expenses between you and your partner</div>

      {settled && (
        <div style={{ background:'rgba(122,170,130,0.15)', border:'0.5px solid rgba(122,170,130,0.3)', borderRadius:12, padding:'16px 20px', marginBottom:20, color:'var(--income)', fontSize:14 }}>
          ✓ Settled up — balance reset to zero.
        </div>
      )}

      {/* Balance cards */}
      {loading ? (
        <div className="skeleton" style={{ height:160, borderRadius:'var(--r)', marginBottom:20 }} />
      ) : (
        <div className="card" style={{ padding:'24px', marginBottom:20 }}>
          <div style={{ display:'flex', gap:16, marginBottom:24, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:120, background:'var(--bg3)', borderRadius:12, padding:'16px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:6 }}>Total joint spend</div>
              <div style={{ fontFamily:'var(--serif)', fontSize:28 }}>{fmt(totalJoint)}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>unsettled</div>
            </div>
            <div style={{ flex:1, minWidth:120, background:'var(--bg3)', borderRadius:12, padding:'16px' }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:6 }}>Fair share each</div>
              <div style={{ fontFamily:'var(--serif)', fontSize:28 }}>{fmt(fair)}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>50 / 50 split</div>
            </div>
            {owesEntry && (
              <div style={{ flex:1, minWidth:120, background:'rgba(196,112,90,0.1)', borderRadius:12, padding:'16px', border:'0.5px solid rgba(196,112,90,0.2)' }}>
                <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:6 }}>Balance due</div>
                <div style={{ fontFamily:'var(--serif)', fontSize:28, color:'var(--danger)' }}>{fmt(owesEntry.owes)}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>to settle</div>
              </div>
            )}
          </div>

          {owesEntry ? (
            <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:20 }}>
              <div style={{ fontSize:14, marginBottom:12 }}>
                Ready to settle <strong style={{ color:'var(--accent)' }}>{fmt(owesEntry.owes)}</strong>?
              </div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <input
                  className="input"
                  placeholder="Note (optional) — e.g. Venmo sent"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ flex:1, minWidth:200 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSettle}
                  disabled={settling}
                  style={{ flexShrink:0 }}
                >
                  {settling ? 'Settling…' : `Settle ${fmt(owesEntry.owes)} →`}
                </button>
              </div>
            </div>
          ) : !loading && (
            <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:20, color:'var(--income)', fontSize:14 }}>
              ✓ All settled up — you're even.
            </div>
          )}
        </div>
      )}

      {/* Joint transactions */}
      {balance?.transactions?.length > 0 && (
        <div className="card" style={{ overflow:'hidden', marginBottom:20 }}>
          <div style={{ padding:'14px 20px 10px', fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase', borderBottom:'0.5px solid var(--border)' }}>
            Unsettled joint transactions
          </div>
          {balance.transactions.slice(0, 20).map((tx, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', borderBottom:'0.5px solid var(--border)', fontSize:13 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.description || tx.accounts?.name}</div>
              </div>
              <div style={{ color:'var(--danger)', fontWeight:500, flexShrink:0 }}>{fmt(tx.amount)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Settlement history */}
      {history.length > 0 && (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 20px 10px', fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase', borderBottom:'0.5px solid var(--border)' }}>
            Settlement history
          </div>
          {history.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 20px', borderBottom:'0.5px solid var(--border)', fontSize:13 }}>
              <div style={{ flex:1 }}>
                <div style={{ color:'var(--income)' }}>Settled {fmt(s.amount)}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                  {s.notes || `${s.transaction_count} transactions cleared`}
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--subtle)' }}>
                {format(new Date(s.created_at), 'MMM d, yyyy')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

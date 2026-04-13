import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/supabase.js'
import { useAuthStore } from '../stores/auth.js'
import { format } from 'date-fns'

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(n)
}

function StatCard({ label, value, sub, valueClass }) {
  return (
    <div className="card" style={{ padding:'14px', overflow:'hidden', minWidth:0, width:'100%' }}>
      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
      <div style={{ fontFamily:'var(--serif)', fontSize:20, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} className={valueClass}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const name = user?.user_metadata?.name || 'there'
  const now = new Date()
  const [summary, setSummary] = useState(null)
  const [split, setSplit] = useState(null)
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [summaryData, splitData, txData] = await Promise.all([
          api.get(`/transactions/summary?month=${now.getMonth()+1}&year=${now.getFullYear()}`),
          api.get('/split/balance'),
          api.get('/transactions?limit=5&visibility=personal')
        ])
        setSummary(summaryData)
        setSplit(splitData)
        setRecentTx(txData.data || [])
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const owes = split?.balances?.find(b => b.owes > 0)

  return (
    <div style={{ padding:'16px', width:'100%', boxSizing:'border-box', maxWidth:900, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          <span style={{ fontStyle:'italic', color:'var(--accent)' }}>{name.split(' ')[0]}</span>
        </div>
        <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
          {format(now, 'MMMM yyyy')} · {format(now, 'd')} days in
        </div>
      </div>

      {/* Stat cards — 2 col grid, fully contained */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16, width:'100%' }}>
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="card skeleton" style={{ height:82, width:'100%' }} />
          ))
        ) : (
          <>
            <StatCard label="Income"    value={fmt(summary?.income || 0)}   sub="this month" valueClass="pos" />
            <StatCard label="Spend"     value={fmt(summary?.expenses || 0)} sub="this month" />
            <StatCard label="Net"       value={fmt(summary?.net || 0)}      sub={summary?.net >= 0 ? 'ahead' : 'over'} valueClass={summary?.net >= 0 ? 'pos' : 'neg'} />
            <StatCard label="Joint"     value={fmt(summary?.joint || 0)}    sub="shared" />
          </>
        )}
      </div>

      {/* Joint balance */}
      {split && !loading && (
        <div className="card" style={{ padding:'16px', marginBottom:16, overflow:'hidden', width:'100%' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:8 }}>
            <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase' }}>Joint balance</div>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/split')} style={{ flexShrink:0 }}>Details →</button>
          </div>
          {owes ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>owed this cycle</div>
                <div style={{ fontFamily:'var(--serif)', fontSize:20, color:'var(--income)' }}>+{fmt(owes.owes)}</div>
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/split')} style={{ width:'100%', justifyContent:'center', fontSize:13 }}>
                Settle up {fmt(owes.owes)} →
              </button>
            </div>
          ) : (
            <div style={{ color:'var(--muted)', fontSize:13 }}>All settled up ✓</div>
          )}
        </div>
      )}

      {/* Quick import */}
      <div
        className="card"
        onClick={() => navigate('/import')}
        style={{ padding:'14px 16px', marginBottom:16, cursor:'pointer', borderStyle:'dashed', borderColor:'var(--border2)', display:'flex', alignItems:'center', gap:12, transition:'border-color 0.2s', overflow:'hidden', width:'100%' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      >
        <div style={{ width:36, height:36, background:'var(--bg3)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>⬆</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Import transactions</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>PDF, CSV, or paste from your bank</div>
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          {['PDF','CSV'].map(t => (
            <span key={t} style={{ background:'var(--bg3)', color:'var(--muted)', border:'0.5px solid var(--border2)', fontSize:9, padding:'2px 6px', borderRadius:4 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card" style={{ overflow:'hidden', width:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px 10px', gap:8 }}>
          <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase' }}>Recent</div>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/transactions')} style={{ flexShrink:0 }}>All →</button>
        </div>
        <div className="divider" />

        {loading ? (
          [1,2,3].map(i => (
            <div key={i} style={{ display:'flex', gap:10, padding:'11px 16px', borderBottom:'0.5px solid var(--border)' }}>
              <div className="skeleton" style={{ width:30, height:30, borderRadius:8, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div className="skeleton" style={{ height:13, width:'60%', marginBottom:6 }} />
                <div className="skeleton" style={{ height:11, width:'40%' }} />
              </div>
              <div className="skeleton" style={{ width:56, height:13, flexShrink:0 }} />
            </div>
          ))
        ) : recentTx.length === 0 ? (
          <div style={{ padding:'28px 16px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
            No transactions yet — import your first statement above
          </div>
        ) : (
          recentTx.map(tx => (
            <div key={tx.id}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:'0.5px solid var(--border)', cursor:'pointer', minWidth:0, overflow:'hidden' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/transactions')}
            >
              <div style={{ width:30, height:30, borderRadius:8, background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>
                {tx.type === 'income' ? '💼' : '💳'}
              </div>
              <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {tx.description}
                  {tx.is_joint && <span className="pill pill-joint" style={{ marginLeft:6, fontSize:9 }}>joint</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {tx.category}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0, minWidth:64 }}>
                <div style={{ fontSize:13, fontWeight:500 }} className={tx.type === 'income' ? 'pos' : ''}>
                  {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                </div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
                  {format(new Date(tx.date + 'T00:00:00'), 'MMM d')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
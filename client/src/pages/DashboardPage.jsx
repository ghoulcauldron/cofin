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
    <div className="card" style={{ padding:'16px', minWidth:0 }}>
      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'var(--serif)', fontSize:22, lineHeight:1 }} className={valueClass}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>{sub}</div>}
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
          api.get('/transactions?limit=5')
        ])
        setSummary(summaryData)
        setSplit(splitData)
        setRecentTx(txData.data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const owes = split?.balances?.find(b => b.owes > 0)

  return (
    <div style={{ padding:'20px 16px', maxWidth:900, margin:'0 auto', boxSizing:'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:'var(--serif)', fontSize:28, letterSpacing:'-0.5px' }}>
          Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          <span style={{ fontStyle:'italic', color:'var(--accent)' }}>{name.split(' ')[0]}</span>
        </div>
        <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
          {format(now, 'MMMM yyyy')} · {format(now, 'd')} days in
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10, marginBottom:20 }}>
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="card skeleton" style={{ flex:1, minWidth:140, height:90 }} />
          ))
        ) : (
          <>
            <StatCard label="Monthly income"  value={fmt(summary?.income || 0)}   sub="this month" valueClass="pos" />
            <StatCard label="Monthly spend"   value={fmt(summary?.expenses || 0)}  sub="this month" />
            <StatCard label="Net"             value={fmt(summary?.net || 0)}       sub={summary?.net >= 0 ? 'ahead of spend' : 'over income'} valueClass={summary?.net >= 0 ? 'pos' : 'neg'} />
            <StatCard label="Joint spend"     value={fmt(summary?.joint || 0)}     sub="shared this month" />
          </>
        )}
      </div>

      {/* Joint balance */}
      {split && !loading && (
        <div className="card" style={{ padding:'18px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase' }}>Joint balance</div>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate('/split')}>View details →</button>
          </div>
          {owes ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center' }}>
              <div style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>owed this cycle</div>
                <div style={{ fontFamily:'var(--serif)', fontSize:22, color:'var(--income)' }}>+{fmt(owes.owes)}</div>
              </div>
              <div style={{ fontSize:13, color:'var(--muted)' }}>→</div>
              <div style={{ flex:1, background:'var(--bg3)', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>settle up</div>
                <button className="btn btn-primary" onClick={() => navigate('/split')} style={{ fontSize:12, padding:'8px 14px' }}>
                  Settle up {fmt(owes.owes)}
                </button>
              </div>
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
        style={{ padding:'14px 16px', marginBottom:20, cursor:'pointer', borderStyle:'dashed', borderColor:'var(--border2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, transition:'border-color 0.2s', flexWrap:'wrap' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      >
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40, height:40, background:'var(--bg3)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>⬆</div>
          <div>
            <div style={{ fontSize:14, fontWeight:500 }}>Import transactions</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>Drop a PDF, CSV, or paste rows from your bank</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          {['PDF','CSV','PASTE'].map(t => (
            <span key={t} className="pill" style={{ background:'var(--bg3)', color:'var(--muted)', border:'0.5px solid var(--border2)', fontSize:10 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px 10px', flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase' }}>Recent</div>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/transactions')}>All transactions →</button>
        </div>
        <div className="divider" />

        {loading ? (
          [1,2,3].map(i => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 20px', borderBottom:'0.5px solid var(--border)' }}>
              <div className="skeleton" style={{ width:32, height:32, borderRadius:8, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div className="skeleton" style={{ height:14, width:'60%', marginBottom:6 }} />
                <div className="skeleton" style={{ height:11, width:'40%' }} />
              </div>
            </div>
          ))
        ) : recentTx.length === 0 ? (
          <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
            No transactions yet — import your first statement above
          </div>
        ) : (
          recentTx.map(tx => (
            <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 20px', borderBottom:'0.5px solid var(--border)', transition:'background 0.1s', cursor:'default' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width:32, height:32, borderRadius:8, background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                {tx.type === 'income' ? '💼' : '💳'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {tx.description}
                  {tx.is_joint && <span className="pill pill-joint" style={{ marginLeft:6, fontSize:9 }}>joint</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>
                  {tx.category} · {tx.accounts?.name || tx.source}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:500 }} className={tx.type === 'income' ? 'pos' : ''}>
                  {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                </div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
                  {format(new Date(tx.date), 'MMM d')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
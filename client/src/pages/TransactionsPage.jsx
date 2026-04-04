// TransactionsPage.jsx
import { useState, useEffect } from 'react'
import { api } from '../lib/supabase.js'
import { format } from 'date-fns'

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n)
}

export default function TransactionsPage() {
  const [txns, setTxns] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const limit = 30

  async function load(off = 0, f = filter) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit, offset: off })
      if (f === 'joint') params.set('is_joint', 'true')
      if (f === 'income') params.set('type', 'income') // note: API doesn't filter type yet, extend as needed
      const data = await api.get(`/transactions?${params}`)
      setTxns(off === 0 ? data.data : prev => [...prev, ...data.data])
      setCount(data.count)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { setOffset(0); load(0, filter) }, [filter])

  return (
    <div style={{ padding:'24px 20px', maxWidth:900, margin:'0 auto' }}>
      <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px', marginBottom:4 }}>Transactions</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>{count} total</div>

      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {['all','joint','income'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="btn btn-sm"
            style={{ background: filter === f ? 'var(--bg4)' : 'transparent', color: filter === f ? 'var(--text)' : 'var(--muted)', border:'0.5px solid var(--border2)' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow:'hidden' }}>
        {loading && txns.length === 0 ? (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 20px', borderBottom:'0.5px solid var(--border)' }}>
              <div className="skeleton" style={{ width:32, height:32, borderRadius:8, flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div className="skeleton" style={{ height:13, width:'55%', marginBottom:6 }} />
                <div className="skeleton" style={{ height:11, width:'35%' }} />
              </div>
              <div className="skeleton" style={{ width:70, height:13 }} />
            </div>
          ))
        ) : txns.length === 0 ? (
          <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--muted)' }}>No transactions found</div>
        ) : (
          txns.map(tx => (
            <div key={tx.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 20px', borderBottom:'0.5px solid var(--border)' }}
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
                  {tx.source !== 'manual' && <span className="pill pill-manual" style={{ marginLeft:4, fontSize:9 }}>{tx.source}</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{tx.category}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
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
        {txns.length < count && (
          <div style={{ padding:'16px', textAlign:'center' }}>
            <button className="btn btn-ghost" onClick={() => { const o = offset + limit; setOffset(o); load(o) }}>
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

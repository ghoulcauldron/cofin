import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/supabase.js'
import { format } from 'date-fns'
import CategorySelect from '../components/CategorySelect.jsx'
import { useCategories } from '../hooks/useCategories.js'

const SORT_OPTIONS = [
  { value: 'date:desc',   label: 'Newest first' },
  { value: 'date:asc',    label: 'Oldest first' },
  { value: 'amount:desc', label: 'Highest amount' },
  { value: 'amount:asc',  label: 'Lowest amount' },
]

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income',  label: 'Income' },
  { key: 'joint',   label: 'Joint' },
]

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n)
}

function txIcon(tx) {
  const d = (tx.category || '').toLowerCase()
  if (tx.type === 'income') return '💼'
  if (d.includes('groceries')) return '🛒'
  if (d.includes('dining')) return '🍽'
  if (d.includes('transport')) return '🚇'
  if (d.includes('utilities')) return '⚡'
  if (d.includes('health')) return '💊'
  if (d.includes('travel')) return '✈'
  if (d.includes('entertainment')) return '🎬'
  if (d.includes('transfer') || d.includes('cc payment')) return '↔'
  if (d.includes('shopping')) return '🛍'
  if (d.includes('rent') || d.includes('mortgage')) return '🏠'
  return '💳'
}

// ── Edit Drawer ─────────────────────────────────────────────────────────────
function EditDrawer({ tx, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    date: tx.date, description: tx.description,
    amount: tx.amount, type: tx.type,
    category: tx.category || 'Uncategorized',
    is_joint: tx.is_joint || false, notes: tx.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const updated = await api.patch(`/transactions/${tx.id}`, { ...form, amount: parseFloat(form.amount) || 0 })
      onSave(updated)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try { await api.delete(`/transactions/${tx.id}`); onDelete(tx.id) }
    catch (e) { setError(e.message); setDeleting(false) }
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inp = { width:'100%', background:'var(--bg3)', border:'0.5px solid var(--border2)', borderRadius:8, padding:'10px 14px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'var(--sans)', boxSizing:'border-box' }
  const lbl = { fontSize:11, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase', display:'block', marginBottom:6 }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }} />
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'min(440px, 100vw)', background:'var(--bg2)', borderLeft:'0.5px solid var(--border)', zIndex:201, display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'0.5px solid var(--border)', position:'sticky', top:0, background:'var(--bg2)', zIndex:1 }}>
          <div style={{ fontFamily:'var(--serif)', fontSize:18 }}>Edit transaction</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer', padding:4 }}>×</button>
        </div>

        <div style={{ padding:'24px', flex:1 }}>
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Description</label>
            <input style={inp} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <label style={lbl}>Amount</label>
              <input style={inp} type="number" step="0.01" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <div style={{ display:'flex', gap:6, paddingTop:4 }}>
                {['expense','income'].map(t => (
                  <button key={t} onClick={() => set('type', t)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:'0.5px solid var(--border2)', background: form.type === t ? (t === 'income' ? 'rgba(122,170,130,0.2)' : 'rgba(196,112,90,0.2)') : 'var(--bg3)', color: form.type === t ? (t === 'income' ? 'var(--income)' : 'var(--danger)') : 'var(--muted)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--sans)' }}>
                    {t === 'income' ? '+ In' : '− Out'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Date</label>
            <input style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Category</label>
            <CategorySelect
              value={form.category}
              onChange={name => set('category', name)}
            />
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight:72, resize:'vertical', lineHeight:1.6 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" />
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--bg3)', borderRadius:10, marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500 }}>Joint expense</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Split between partners</div>
            </div>
            <div onClick={() => set('is_joint', !form.is_joint)} style={{ width:40, height:22, borderRadius:11, background: form.is_joint ? 'var(--accent2)' : 'var(--bg4)', position:'relative', cursor:'pointer', transition:'background 0.2s', border:'0.5px solid var(--border2)', flexShrink:0 }}>
              <div style={{ position:'absolute', top:2, left: form.is_joint ? 20 : 2, width:16, height:16, borderRadius:'50%', background: form.is_joint ? '#fff' : 'var(--muted)', transition:'left 0.2s' }} />
            </div>
          </div>

          {error && <div style={{ padding:'10px 14px', background:'rgba(196,112,90,0.1)', borderRadius:8, color:'var(--danger)', fontSize:13 }}>{error}</div>}
        </div>

        <div style={{ padding:'16px 24px', borderTop:'0.5px solid var(--border)', display:'flex', gap:10, position:'sticky', bottom:0, background:'var(--bg2)' }}>
          <button onClick={handleDelete} disabled={deleting} style={{ padding:'10px 16px', borderRadius:8, fontSize:13, cursor:'pointer', background: confirmDelete ? 'rgba(196,112,90,0.15)' : 'transparent', color: confirmDelete ? 'var(--danger)' : 'var(--subtle)', border:`0.5px solid ${confirmDelete ? 'rgba(196,112,90,0.4)' : 'var(--border)'}`, fontFamily:'var(--sans)' }}>
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
          {confirmDelete && (
            <button onClick={() => setConfirmDelete(false)} style={{ padding:'10px 14px', borderRadius:8, fontSize:13, background:'transparent', color:'var(--muted)', border:'0.5px solid var(--border)', cursor:'pointer', fontFamily:'var(--sans)' }}>Cancel</button>
          )}
          <button onClick={handleSave} disabled={saving} style={{ marginLeft:'auto', padding:'10px 20px', borderRadius:8, fontSize:13, background:'var(--accent)', color:'#1a150e', border:'none', cursor:'pointer', fontWeight:500, fontFamily:'var(--sans)' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [txns, setTxns] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('date:desc')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const { names: categoryNames } = useCategories()
  const searchTimer = useRef(null)
  const limit = 30
  const [sortBy, sortDir] = sort.split(':')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  async function load(off = 0, opts = {}) {
    setLoading(true)
    try {
      const f   = opts.filter   ?? filter
      const cat = opts.category ?? category
      const sb  = opts.sortBy   ?? sortBy
      const sd  = opts.sortDir  ?? sortDir
      const q   = opts.search   ?? search
      const params = new URLSearchParams({ limit, offset: off, sort_by: sb, sort_dir: sd })
      if (f === 'joint')   params.set('is_joint', 'true')
      if (f === 'income')  params.set('type', 'income')
      if (f === 'expense') params.set('type', 'expense')
      if (cat)             params.set('category', cat)
      if (q)               params.set('search', q)
      const data = await api.get(`/transactions?${params}`)
      setTxns(off === 0 ? (data.data || []) : prev => [...prev, ...(data.data || [])])
      setCount(data.count || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { setOffset(0); load(0, { filter, category, sortBy, sortDir, search }) }, [filter, category, sort, search])

  function handleSearchInput(val) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setOffset(0); setSearch(val) }, 350)
  }

  function clearFilters() {
    setFilter('all'); setCategory(''); setSort('date:desc'); setSearch(''); setSearchInput('')
  }

  const hasActiveFilters = filter !== 'all' || category || sort !== 'date:desc' || search

  const handleSave = useCallback((updated) => {
    setTxns(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditing(null)
  }, [])

  const handleDelete = useCallback((id) => {
    setTxns(prev => prev.filter(t => t.id !== id))
    setCount(prev => prev - 1)
    setEditing(null)
  }, [])

  const selStyle = (active) => ({
    width: '100%',
    background: 'var(--bg2)',
    border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12,
    color: active ? 'var(--text)' : 'var(--muted)',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    boxSizing: 'border-box',
  })

  return (
    <div style={{ padding:'16px', width:'100%', boxSizing:'border-box', maxWidth:900, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:'var(--serif)', fontSize:24, letterSpacing:'-0.5px' }}>Transactions</div>
        <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>
          {count} {search ? `matching "${search}"` : 'total'}
        </div>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:10, width:'100%' }}>
        <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--subtle)', fontSize:14, pointerEvents:'none' }}>⌕</span>
        <input
          value={searchInput}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder="Search transactions…"
          style={{ width:'100%', background:'var(--bg2)', border:'0.5px solid var(--border2)', borderRadius:10, padding:'10px 36px', fontSize:14, color:'var(--text)', outline:'none', fontFamily:'var(--sans)', boxSizing:'border-box' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border2)'}
        />
        {searchInput && (
          <button onClick={() => { setSearchInput(''); setSearch('') }} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
        )}
      </div>

      {/* Filters — stacked on mobile, inline on desktop */}
      {isMobile ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12, width:'100%' }}>
          {/* Type pills row */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)} className="btn btn-sm"
                style={{ background: filter === key ? 'var(--bg4)' : 'transparent', color: filter === key ? 'var(--text)' : 'var(--muted)', border:'0.5px solid var(--border2)', whiteSpace:'nowrap' }}>
                {label}
              </button>
            ))}
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', padding:'4px 8px', fontFamily:'var(--sans)' }}>Clear ×</button>
            )}
          </div>
          {/* Sort + category row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width:'100%' }}>
            <select value={sort} onChange={e => setSort(e.target.value)} style={selStyle(sort !== 'date:desc')}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)} style={selStyle(!!category)}>
              <option value="">All categories</option>
              {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} className="btn btn-sm"
              style={{ background: filter === key ? 'var(--bg4)' : 'transparent', color: filter === key ? 'var(--text)' : 'var(--muted)', border:'0.5px solid var(--border2)', whiteSpace:'nowrap' }}>
              {label}
            </button>
          ))}
          <div style={{ width:'0.5px', height:16, background:'var(--border2)', flexShrink:0 }} />
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...selStyle(sort !== 'date:desc'), width:'auto', flex:'0 0 auto' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...selStyle(!!category), width:'auto', flex:'0 0 auto' }}>
            <option value="">All categories</option>
            {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', padding:'4px 8px', borderRadius:6, fontFamily:'var(--sans)', whiteSpace:'nowrap' }}>Clear ×</button>
          )}
        </div>
      )}

      {/* List */}
      <div className="card" style={{ overflow:'hidden', width:'100%' }}>
        {loading && txns.length === 0 ? (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{ display:'flex', gap:10, padding:'12px 16px', borderBottom:'0.5px solid var(--border)' }}>
              <div className="skeleton" style={{ width:30, height:30, borderRadius:8, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div className="skeleton" style={{ height:13, width:'55%', marginBottom:6 }} />
                <div className="skeleton" style={{ height:11, width:'35%' }} />
              </div>
              <div className="skeleton" style={{ width:56, height:13, flexShrink:0 }} />
            </div>
          ))
        ) : txns.length === 0 ? (
          <div style={{ padding:'48px 16px', textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:24, marginBottom:12 }}>◎</div>
            <div style={{ fontSize:14, marginBottom:8 }}>No transactions found</div>
            {hasActiveFilters && <button onClick={clearFilters} className="btn btn-ghost btn-sm">Clear filters</button>}
          </div>
        ) : (
          txns.map(tx => (
            <div key={tx.id} onClick={() => setEditing(tx)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderBottom:'0.5px solid var(--border)', cursor:'pointer', transition:'background 0.1s', overflow:'hidden', width:'100%', boxSizing:'border-box' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width:30, height:30, borderRadius:8, background:'var(--bg4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                {txIcon(tx)}
              </div>
              <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
                <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {tx.description}
                  {tx.is_joint && <span className="pill pill-joint" style={{ marginLeft:6, fontSize:9 }}>joint</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.category}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0, minWidth:64 }}>
                <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap' }} className={tx.type === 'income' ? 'pos' : ''}>
                  {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                </div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:2, whiteSpace:'nowrap' }}>
                  {format(new Date(tx.date + 'T00:00:00'), 'MMM d')}
                </div>
              </div>
            </div>
          ))
        )}
        {txns.length < count && (
          <div style={{ padding:'16px', textAlign:'center' }}>
            <button className="btn btn-ghost" onClick={() => { const o = offset + limit; setOffset(o); load(o) }}>
              Load more ({count - txns.length} remaining)
            </button>
          </div>
        )}
      </div>

      {editing && (
        <EditDrawer tx={editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  )
}
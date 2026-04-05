import { useState, useRef, useCallback } from 'react'
import { api } from '../lib/supabase.js'
import { useNavigate } from 'react-router-dom'

const INSTITUTIONS = ['generic','chase','amex','bofa','citi','wellsfargo']

const CATEGORIES = [
  // Spending
  'Groceries','Dining','Transportation','Utilities','Rent/Mortgage',
  'Entertainment','Shopping','Health','Travel','Subscriptions',
  'Insurance','Personal Care','Education','Pets',
  // Money movement
  'CC Payment','Transfer','P2P Transfer','ATM/Cash',
  // Income
  'Income','Freelance Income','Reimbursement',
  // Catch-all
  'Uncategorized'
]

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n)
}

export default function ImportPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('upload') // 'upload' | 'paste'
  const [institution, setInstitution] = useState('generic')
  const [dragging, setDragging] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parsed, setParsed] = useState(null) // { transactions, count, source }
  const [reviewed, setReviewed] = useState([]) // user-edited transactions
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef()

  // ── Parse handlers ──────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('institution', institution)
      const result = await api.upload('/import/upload', fd)
      setParsed(result)
      setReviewed(result.transactions.map((t, i) => ({ ...t, _id: i, _include: true })))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePaste() {
    if (!pasteText.trim()) return
    setError('')
    setLoading(true)
    try {
      const result = await api.post('/import/paste', { text: pasteText, institution })
      setParsed(result)
      setReviewed(result.transactions.map((t, i) => ({ ...t, _id: i, _include: true })))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Drag/drop ────────────────────────────────────────────────
  const onDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [institution])

  // ── Review edits ────────────────────────────────────────────
  function updateRow(id, field, value) {
    setReviewed(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r))
  }

  // ── Save ────────────────────────────────────────────────────
  async function save() {
    const toSave = reviewed
      .filter(r => r._include)
      .map(({ _id, _include, raw, ...rest }) => rest)

    setSaving(true)
    try {
      const result = await api.post('/transactions/bulk', { transactions: toSave })
      setDone({ inserted: result.inserted, skipped: result.skipped })
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Reset ───────────────────────────────────────────────────
  function reset() {
    setParsed(null)
    setReviewed([])
    setPasteText('')
    setDone(false)
    setError('')
  }

  // ── Done screen ─────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ padding:'40px 20px', maxWidth:600, margin:'0 auto', textAlign:'center' }} className="animate-fadeUp">
        <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
        <div style={{ fontFamily:'var(--serif)', fontSize:24, marginBottom:8 }}>
          {done.inserted} transaction{done.inserted !== 1 ? 's' : ''} imported
        </div>
        {done.skipped > 0 && (
          <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>
            {done.skipped} duplicate{done.skipped !== 1 ? 's' : ''} skipped
          </div>
        )}
        <div style={{ fontSize:14, color:'var(--muted)', marginBottom:32, marginTop:8 }}>
          They're now in your transaction list, ready for categorisation.
        </div>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/transactions')}>View transactions</button>
          <button className="btn btn-ghost" onClick={reset}>Import more</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding:'24px 20px', maxWidth:900, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:'var(--serif)', fontSize:26, letterSpacing:'-0.5px' }}>Import</div>
        <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>PDF statement, CSV export, or paste rows directly from your bank's website</div>
      </div>

      {!parsed ? (
        <>
          {/* Mode + institution selector */}
          <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:6 }}>
              {['upload','paste'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="btn"
                  style={{ background: mode === m ? 'var(--accent)' : 'var(--bg3)', color: mode === m ? '#1a150e' : 'var(--muted)', border:'0.5px solid var(--border2)' }}>
                  {m === 'upload' ? '⬆ File' : '✏ Paste'}
                </button>
              ))}
            </div>
            <select
              className="input select"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              style={{ width:'auto', minWidth:140 }}
            >
              {INSTITUTIONS.map(i => (
                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Upload mode */}
          {mode === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius:'var(--r-lg)',
                padding:'60px 24px',
                textAlign:'center',
                cursor:'pointer',
                background: dragging ? 'rgba(200,184,154,0.04)' : 'var(--bg2)',
                transition:'all 0.2s',
              }}
            >
              <div style={{ fontSize:40, marginBottom:12 }}>⬆</div>
              <div style={{ fontSize:16, fontWeight:500, marginBottom:8 }}>
                Drop your statement here
              </div>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>
                PDF or CSV — up to 20MB
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                {['PDF','CSV'].map(t => (
                  <span key={t} className="pill" style={{ background:'var(--bg3)', color:'var(--muted)', border:'0.5px solid var(--border2)' }}>{t}</span>
                ))}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.csv"
                style={{ display:'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* Paste mode */}
          {mode === 'paste' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ fontSize:13, color:'var(--muted)', background:'var(--bg3)', borderRadius:10, padding:'12px 16px' }}>
                Go to your bank's website → transaction history → select all rows → copy → paste below.
                Works with Chase, Amex, BofA, Citi, and most others.
              </div>
              <textarea
                className="input"
                style={{ minHeight:200, fontFamily:'var(--sans)', fontSize:12, resize:'vertical', lineHeight:1.6 }}
                placeholder={'01/15	Whole Foods Market	-$84.32\n01/16	Direct deposit — Employer	$4,200.00\n01/17	Netflix	-$15.49'}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handlePaste}
                disabled={!pasteText.trim() || loading}
                style={{ alignSelf:'flex-start' }}
              >
                {loading ? 'Parsing…' : 'Parse transactions →'}
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign:'center', padding:'32px', color:'var(--muted)', fontSize:14 }}>
              Reading your statement…
            </div>
          )}

          {error && (
            <div style={{ marginTop:16, padding:'12px 16px', background:'rgba(196,112,90,0.1)', borderRadius:10, color:'var(--danger)', fontSize:13 }}>
              {error}
            </div>
          )}
        </>
      ) : (
        /* ── Review table ─────────────────────────────────────── */
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
            <div>
              <span style={{ fontFamily:'var(--serif)', fontSize:20 }}>{parsed.count} transactions found</span>
              <span style={{ fontSize:13, color:'var(--muted)', marginLeft:12 }}>from {parsed.institution} · {parsed.source}</span>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" onClick={reset}>Start over</button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || reviewed.filter(r => r._include).length === 0}
              >
                {saving ? 'Saving…' : `Save ${reviewed.filter(r => r._include).length} transactions →`}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom:16, padding:'12px 16px', background:'rgba(196,112,90,0.1)', borderRadius:10, color:'var(--danger)', fontSize:13 }}>
              {error}
            </div>
          )}

          {/* Select all + bulk edit toolbar */}
          <div style={{ display:'flex', gap:12, marginBottom:12, fontSize:12, color:'var(--muted)', flexWrap:'wrap', alignItems:'center' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setReviewed(prev => prev.map(r => ({ ...r, _include: true })))}>Select all</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setReviewed(prev => prev.map(r => ({ ...r, _include: false })))}>Deselect all</button>
            <span style={{ width:'0.5px', height:16, background:'var(--border2)', alignSelf:'center' }} />
            {/* Bulk category */}
            <select
              defaultValue=""
              onChange={e => {
                if (!e.target.value) return
                const cat = e.target.value
                setReviewed(prev => prev.map(r => r._include ? { ...r, category: cat } : r))
                e.target.value = ''
              }}
              style={{ background:'var(--bg3)', border:'0.5px solid var(--border2)', color:'var(--muted)', fontSize:11, borderRadius:6, padding:'3px 8px', outline:'none', cursor:'pointer' }}
            >
              <option value="" disabled>Set category for selected…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* Bulk joint */}
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setReviewed(prev => {
                const anyJoint = prev.some(r => r._include && r.is_joint)
                return prev.map(r => r._include ? { ...r, is_joint: !anyJoint } : r)
              })}
              style={{ display:'flex', alignItems:'center', gap:5 }}
            >
              <span style={{ width:10, height:10, borderRadius:2, background:'var(--accent2)', display:'inline-block', opacity:0.8 }} />
              Toggle joint for selected
            </button>
            <span style={{ marginLeft:'auto', alignSelf:'center' }}>{reviewed.filter(r => r._include).length} selected</span>
          </div>

          <div className="card" style={{ overflow:'hidden' }}>
            {/* Table header */}
            <div style={{ display:'grid', gridTemplateColumns:'28px 90px 1fr 120px 90px 70px', gap:12, padding:'10px 16px', fontSize:10, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase', borderBottom:'0.5px solid var(--border)' }}>
              <span></span>
              <span>Date</span>
              <span>Description</span>
              <span>Category</span>
              <span style={{ textAlign:'right' }}>Amount</span>
              <span>Joint</span>
            </div>

            {/* Rows — scrollable on mobile */}
            <div style={{ maxHeight:'60vh', overflowY:'auto' }}>
              {reviewed.map(row => (
                <div key={row._id} style={{
                  display:'grid', gridTemplateColumns:'28px 90px 1fr 120px 90px 70px',
                  gap:12, padding:'9px 16px', alignItems:'center',
                  borderBottom:'0.5px solid var(--border)',
                  opacity: row._include ? 1 : 0.35,
                  transition:'opacity 0.15s',
                  fontSize:12,
                }}>
                  {/* Include checkbox */}
                  <input
                    type="checkbox"
                    checked={row._include}
                    onChange={e => updateRow(row._id, '_include', e.target.checked)}
                    style={{ accentColor:'var(--accent)', width:14, height:14 }}
                  />
                  {/* Date */}
                  <input
                    type="date"
                    value={row.date}
                    onChange={e => updateRow(row._id, 'date', e.target.value)}
                    style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:11, width:'100%', outline:'none' }}
                  />
                  {/* Description */}
                  <input
                    type="text"
                    value={row.description}
                    onChange={e => updateRow(row._id, 'description', e.target.value)}
                    style={{ background:'transparent', border:'none', color:'var(--text)', fontSize:12, width:'100%', outline:'none' }}
                  />
                  {/* Category */}
                  <select
                    value={row.category || 'Uncategorized'}
                    onChange={e => updateRow(row._id, 'category', e.target.value)}
                    style={{ background:'var(--bg3)', border:'none', color:'var(--text)', fontSize:11, borderRadius:6, padding:'3px 6px', outline:'none', width:'100%' }}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* Amount */}
                  <div style={{ textAlign:'right', fontWeight:500 }} className={row.type === 'income' ? 'pos' : 'neg'}>
                    {row.type === 'income' ? '+' : '−'}{fmt(row.amount)}
                  </div>
                  {/* Joint toggle */}
                  <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                    <input
                      type="checkbox"
                      checked={row.is_joint || false}
                      onChange={e => updateRow(row._id, 'is_joint', e.target.checked)}
                      style={{ accentColor:'var(--accent2)', width:13, height:13 }}
                    />
                    <span style={{ fontSize:10, color:'var(--muted)' }}>joint</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useCategories } from '../hooks/useCategories.js'

// Reusable category dropdown with inline add + manage link
// Props:
//   value         — current category name string
//   onChange      — (name) => void
//   style         — optional additional styles for the select element
//   showManage    — whether to show "Manage categories" option (default true)

export default function CategorySelect({ value, onChange, style = {}, showManage = true }) {
  const { categories, names, loading, addCategory } = useCategories()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('expense')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const baseStyle = {
    width: '100%',
    background: 'var(--bg3)',
    border: '0.5px solid var(--border2)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--text)',
    outline: 'none',
    fontFamily: 'var(--sans)',
    boxSizing: 'border-box',
    appearance: 'none',
    cursor: 'pointer',
    ...style
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true); setErr('')
    try {
      const cat = await addCategory(newName.trim(), newType)
      onChange(cat.name)
      setNewName('')
      setAdding(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  function handleChange(e) {
    if (e.target.value === '__add__') { setAdding(true); return }
    onChange(e.target.value)
  }

  if (adding) {
    return (
      <div>
        <div style={{ display:'flex', gap:8, marginBottom:6 }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="New category name"
            style={{ ...baseStyle, flex:1 }}
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            style={{ ...baseStyle, width:'auto', padding:'10px 10px', fontSize:12 }}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="any">Any</option>
          </select>
        </div>
        {err && <div style={{ fontSize:11, color:'var(--danger)', marginBottom:6 }}>{err}</div>}
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            style={{ flex:1, padding:'8px', borderRadius:8, background:'var(--accent)', color:'#1a150e', border:'none', cursor:'pointer', fontSize:12, fontWeight:500, fontFamily:'var(--sans)' }}
          >
            {saving ? 'Adding…' : 'Add category'}
          </button>
          <button
            onClick={() => { setAdding(false); setNewName(''); setErr('') }}
            style={{ padding:'8px 14px', borderRadius:8, background:'transparent', color:'var(--muted)', border:'0.5px solid var(--border)', cursor:'pointer', fontSize:12, fontFamily:'var(--sans)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <select
      value={value || 'Uncategorized'}
      onChange={handleChange}
      disabled={loading}
      style={baseStyle}
    >
      {loading ? (
        <option>Loading…</option>
      ) : (
        <>
          {names.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option disabled>──────────</option>
          <option value="__add__">+ Add new category…</option>
        </>
      )}
    </select>
  )
}
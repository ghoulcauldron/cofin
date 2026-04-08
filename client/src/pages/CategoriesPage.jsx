import { useState } from 'react'
import { useCategories } from '../hooks/useCategories.js'
import { api } from '../lib/supabase.js'

const TYPE_LABELS = { expense:'Expense', income:'Income', transfer:'Transfer', any:'Any' }
const TYPE_COLORS = {
  expense: 'var(--danger)',
  income:  'var(--income)',
  transfer:'var(--accent3)',
  any:     'var(--muted)'
}

function RuleRow({ rule, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  async function del() {
    setDeleting(true)
    await api.delete(`/rules/${rule.id}`).catch(() => {})
    onDelete(rule.id)
  }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'0.5px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {rule.match_type === 'exact' ? '= ' : rule.match_type === 'starts_with' ? '^ ' : '~ '}
          <span style={{ color:'var(--text)' }}>{rule.pattern}</span>
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
          → {rule.category}
          {rule.auto_learned && <span style={{ marginLeft:6, fontSize:9, background:'rgba(143,166,138,0.15)', color:'var(--accent2)', borderRadius:4, padding:'1px 5px' }}>learned</span>}
        </div>
      </div>
      <button onClick={del} disabled={deleting}
        style={{ background:'none', border:'none', color:'var(--subtle)', cursor:'pointer', fontSize:16, padding:'2px 6px', fontFamily:'var(--sans)' }}>
        {deleting ? '…' : '×'}
      </button>
    </div>
  )
}

export default function CategoriesPage() {
  const { categories, loading, addCategory, deleteCategory, refetch } = useCategories()
  const [rules, setRules] = useState(null)
  const [rulesLoading, setRulesLoading] = useState(false)
  const [rulesLoaded, setRulesLoaded] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('expense')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [newPattern, setNewPattern] = useState('')
  const [newRuleCategory, setNewRuleCategory] = useState('')
  const [newMatchType, setNewMatchType] = useState('contains')
  const [addingRule, setAddingRule] = useState(false)
  const [ruleError, setRuleError] = useState('')

  async function loadRules() {
    if (rulesLoaded) return
    setRulesLoading(true)
    const data = await api.get('/rules').catch(() => [])
    setRules(data)
    setRulesLoaded(true)
    setRulesLoading(false)
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true); setAddError('')
    try {
      await addCategory(newName.trim(), newType)
      setNewName('')
    } catch (e) { setAddError(e.message) }
    finally { setAdding(false) }
  }

  async function handleDeleteCategory(id) {
    if (!window.confirm('Delete this category? Transactions using it will be set to Uncategorized.')) return
    await deleteCategory(id)
  }

  async function handleAddRule(e) {
    e.preventDefault()
    if (!newPattern.trim() || !newRuleCategory) return
    setAddingRule(true); setRuleError('')
    try {
      const rule = await api.post('/rules', { pattern: newPattern.trim(), match_type: newMatchType, category: newRuleCategory })
      setRules(prev => [rule, ...(prev || [])])
      setNewPattern(''); setNewRuleCategory('')
    } catch (e) { setRuleError(e.message) }
    finally { setAddingRule(false) }
  }

  const categoryNames = categories.map(c => c.name)

  return (
    <div style={{ padding:'16px', width:'100%', boxSizing:'border-box', maxWidth:800, margin:'0 auto' }}>
      <div style={{ fontFamily:'var(--serif)', fontSize:24, letterSpacing:'-0.5px', marginBottom:4 }}>Categories</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:24 }}>Manage categories and auto-categorisation rules</div>

      {/* Categories list */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>Your categories</div>

        <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
          {loading ? (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Loading…</div>
          ) : (
            categories.map(cat => (
              <div key={cat.id}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderBottom:'0.5px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13 }}>{cat.name}</div>
                  <div style={{ fontSize:10, color: TYPE_COLORS[cat.type] || 'var(--muted)', marginTop:2 }}>
                    {TYPE_LABELS[cat.type] || cat.type}
                    {cat.is_system && <span style={{ marginLeft:6, color:'var(--subtle)' }}>· system</span>}
                  </div>
                </div>
                {!cat.is_system && (
                  <button onClick={() => handleDeleteCategory(cat.id)}
                    style={{ background:'none', border:'none', color:'var(--subtle)', cursor:'pointer', fontSize:16, padding:'2px 6px' }}>
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add category form */}
        <form onSubmit={handleAddCategory} style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New category name"
            style={{ flex:1, minWidth:160, background:'var(--bg2)', border:'0.5px solid var(--border2)', borderRadius:8, padding:'9px 14px', fontSize:13, color:'var(--text)', outline:'none', fontFamily:'var(--sans)', boxSizing:'border-box' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border2)'}
          />
          <select value={newType} onChange={e => setNewType(e.target.value)}
            style={{ background:'var(--bg2)', border:'0.5px solid var(--border2)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'var(--muted)', outline:'none', cursor:'pointer', fontFamily:'var(--sans)' }}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="any">Any</option>
          </select>
          <button type="submit" disabled={adding || !newName.trim()}
            style={{ padding:'9px 18px', borderRadius:8, background:'var(--accent)', color:'#1a150e', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'var(--sans)' }}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </form>
        {addError && <div style={{ fontSize:12, color:'var(--danger)', marginTop:6 }}>{addError}</div>}
      </div>

      {/* Merchant rules */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--muted)', letterSpacing:'1px', textTransform:'uppercase' }}>Auto-categorisation rules</div>
            <div style={{ fontSize:12, color:'var(--subtle)', marginTop:3 }}>Applied automatically when importing transactions</div>
          </div>
          {!rulesLoaded && (
            <button onClick={loadRules} className="btn btn-ghost btn-sm">Load rules</button>
          )}
        </div>

        {rulesLoaded && (
          <>
            <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
              {rulesLoading ? (
                <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Loading…</div>
              ) : !rules?.length ? (
                <div style={{ padding:'24px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
                  No rules yet. Rules are created automatically when you categorise transactions, or add them manually below.
                </div>
              ) : (
                rules.map(rule => (
                  <RuleRow key={rule.id} rule={rule} onDelete={id => setRules(prev => prev.filter(r => r.id !== id))} />
                ))
              )}
            </div>

            {/* Add rule form */}
            <form onSubmit={handleAddRule} style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <select value={newMatchType} onChange={e => setNewMatchType(e.target.value)}
                style={{ background:'var(--bg2)', border:'0.5px solid var(--border2)', borderRadius:8, padding:'9px 10px', fontSize:12, color:'var(--muted)', outline:'none', cursor:'pointer', fontFamily:'var(--sans)', flexShrink:0 }}>
                <option value="contains">contains</option>
                <option value="starts_with">starts with</option>
                <option value="exact">exact match</option>
              </select>
              <input
                value={newPattern}
                onChange={e => setNewPattern(e.target.value)}
                placeholder="e.g. lyft, whole foods, con ed"
                style={{ flex:1, minWidth:140, background:'var(--bg2)', border:'0.5px solid var(--border2)', borderRadius:8, padding:'9px 14px', fontSize:13, color:'var(--text)', outline:'none', fontFamily:'var(--sans)', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border2)'}
              />
              <select value={newRuleCategory} onChange={e => setNewRuleCategory(e.target.value)}
                style={{ background:'var(--bg2)', border:`0.5px solid ${newRuleCategory ? 'var(--accent)' : 'var(--border2)'}`, borderRadius:8, padding:'9px 10px', fontSize:12, color: newRuleCategory ? 'var(--text)' : 'var(--muted)', outline:'none', cursor:'pointer', fontFamily:'var(--sans)' }}>
                <option value="">→ category</option>
                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="submit" disabled={addingRule || !newPattern.trim() || !newRuleCategory}
                style={{ padding:'9px 18px', borderRadius:8, background:'var(--accent)', color:'#1a150e', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, fontFamily:'var(--sans)', flexShrink:0 }}>
                {addingRule ? 'Saving…' : '+ Add rule'}
              </button>
            </form>
            {ruleError && <div style={{ fontSize:12, color:'var(--danger)', marginTop:6 }}>{ruleError}</div>}
          </>
        )}
      </div>
    </div>
  )
}
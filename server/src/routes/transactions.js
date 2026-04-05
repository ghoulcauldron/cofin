import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

export const transactionsRouter = Router()
transactionsRouter.use(requireAuth)

transactionsRouter.get('/', async (req, res) => {
  const { account_id, category, is_joint, month, year, limit = 50, offset = 0 } = req.query
  let query = supabase
    .from('transactions')
    .select('*, accounts(name, institution)', { count: 'exact' })
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order('date', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (account_id) query = query.eq('account_id', account_id)
  if (category) query = query.eq('category', category)
  if (is_joint !== undefined) query = query.eq('is_joint', is_joint === 'true')
  if (month && year) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(year, month, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }

  const { data, error, count } = await query
  if (error) return res.status(400).json({ error: error.message })
  res.json({ data, count })
})

transactionsRouter.post('/', async (req, res) => {
  const { account_id, date, description, amount, type, category, is_joint, notes, source } = req.body
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      workspace_id: req.user.user_metadata.workspaceId,
      created_by: req.user.id,
      account_id, date, description, amount, type,
      category: category || 'Uncategorized',
      is_joint: is_joint || false,
      notes: notes || null,
      source: source || 'manual'
    })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Bulk insert after import review — with deduplication
transactionsRouter.post('/bulk', async (req, res) => {
  const { transactions } = req.body
  const workspaceId = req.user.user_metadata.workspaceId

  const enriched = transactions.map(t => {
    const fingerprint = Buffer.from(
      `${workspaceId}|${t.date}|${(t.description || '').toLowerCase().trim()}|${Number(t.amount).toFixed(2)}`
    ).toString('base64').slice(0, 64)
    return {
      ...t,
      workspace_id: workspaceId,
      created_by: req.user.id,
      category: t.category || 'Uncategorized',
      is_joint: t.is_joint || false,
      source: t.source || 'import',
      fingerprint
    }
  })

  const { data, error } = await supabase
    .from('transactions')
    .upsert(enriched, {
      onConflict: 'workspace_id,fingerprint',
      ignoreDuplicates: true
    })
    .select()

  if (error) return res.status(400).json({ error: error.message })

  const inserted = data?.length || 0
  const skipped = enriched.length - inserted
  res.json({ inserted, skipped, data })
})

transactionsRouter.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('transactions')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

transactionsRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ success: true })
})

// Summary stats for dashboard
transactionsRouter.get('/summary', async (req, res) => {
  const { month, year } = req.query
  const workspaceId = req.user.user_metadata.workspaceId
  const m = month || new Date().getMonth() + 1
  const y = year || new Date().getFullYear()
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, type, category, is_joint')
    .eq('workspace_id', workspaceId)
    .gte('date', start)
    .lte('date', end)

  if (error) return res.status(400).json({ error: error.message })

  const income = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const joint = data.filter(t => t.is_joint).reduce((s, t) => s + t.amount, 0)

  const byCategory = data.reduce((acc, t) => {
    if (t.type !== 'expense') return acc
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {})

  res.json({ income, expenses, net: income - expenses, joint, byCategory })
})

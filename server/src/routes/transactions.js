import { Router } from 'express'
import { createHash } from 'crypto'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

export const transactionsRouter = Router()
transactionsRouter.use(requireAuth)

transactionsRouter.get('/', async (req, res) => {
  const {
    account_id, category, is_joint, type,
    month, year, search,
    sort_by = 'date', sort_dir = 'desc',
    visibility = 'personal', // 'personal' | 'joint' | 'all'
    limit = 50, offset = 0
  } = req.query

  const ascending = sort_dir === 'asc'

  let query = supabase
    .from('transactions')
    .select('*, accounts(name, institution)', { count: 'exact' })
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order(sort_by, { ascending })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  // Visibility filter — default to personal (mine) + joint (ours)
  if (visibility === 'personal') {
    // Show only this user's transactions (personal) + all joint transactions
    query = query.or(`created_by.eq.${req.user.id},is_joint.eq.true`)
  } else if (visibility === 'joint') {
    query = query.eq('is_joint', true)
  }
  // visibility === 'all' shows everything (no filter)

  if (account_id) query = query.eq('account_id', account_id)
  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)
  if (is_joint !== undefined) query = query.eq('is_joint', is_joint === 'true')
  if (search) query = query.ilike('description', `%${search}%`)
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

// Bulk insert after import review — explicit dedup via fingerprint lookup
transactionsRouter.post('/bulk', async (req, res) => {
  const { transactions } = req.body
  const workspaceId = req.user.user_metadata.workspaceId

  // Generate fingerprints for all incoming transactions
  const enriched = transactions.map(t => {
    const raw = `${workspaceId}|${t.date}|${(t.description || '').toLowerCase().trim()}|${Number(t.amount).toFixed(2)}`
    const fingerprint = createHash('md5').update(raw).digest('hex')
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

  // Fetch existing fingerprints for this workspace to detect duplicates explicitly
  const incomingFingerprints = enriched.map(t => t.fingerprint)
  console.log('[bulk] incoming count:', enriched.length)
  console.log('[bulk] sample fingerprint:', incomingFingerprints[0])

  const { data: existing, error: lookupError } = await supabase
    .from('transactions')
    .select('fingerprint')
    .eq('workspace_id', workspaceId)
    .in('fingerprint', incomingFingerprints)

  console.log('[bulk] existing matches found:', existing?.length, lookupError?.message)

  const existingSet = new Set((existing || []).map(r => r.fingerprint))

  // Only insert rows whose fingerprint doesn't already exist
  const toInsert = enriched.filter(t => !existingSet.has(t.fingerprint))
  const skipped = enriched.length - toInsert.length

  console.log('[bulk] toInsert:', toInsert.length, 'skipped:', skipped)

  if (toInsert.length === 0) {
    return res.json({ inserted: 0, skipped, data: [] })
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(toInsert)
    .select()

  console.log('[bulk] insert result:', data?.length, error?.message)

  if (error) return res.status(400).json({ error: error.message })

  res.json({ inserted: data?.length || 0, skipped, data: data || [] })
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

// Summary stats for dashboard — scoped to current user's personal + joint transactions
transactionsRouter.get('/summary', async (req, res) => {
  const { month, year } = req.query
  const workspaceId = req.user.user_metadata.workspaceId
  const userId = req.user.id
  const m = month || new Date().getMonth() + 1
  const y = year || new Date().getFullYear()
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = new Date(y, m, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, type, category, is_joint, created_by')
    .eq('workspace_id', workspaceId)
    .gte('date', start)
    .lte('date', end)
    .or(`created_by.eq.${userId},is_joint.eq.true`)

  if (error) return res.status(400).json({ error: error.message })

  const income = data.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = data.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const joint = data.filter(t => t.is_joint).reduce((s, t) => s + Number(t.amount), 0)

  const byCategory = data.reduce((acc, t) => {
    if (t.type !== 'expense') return acc
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
    return acc
  }, {})

  res.json({ income, expenses, net: income - expenses, joint, byCategory })
})
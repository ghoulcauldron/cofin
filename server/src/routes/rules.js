import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

export const rulesRouter = Router()
rulesRouter.use(requireAuth)

// Get all rules
rulesRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('merchant_rules')
    .select('*')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Create a rule
rulesRouter.post('/', async (req, res) => {
  const { pattern, match_type, category, is_joint, priority, auto_learned } = req.body
  if (!pattern?.trim() || !category) {
    return res.status(400).json({ error: 'pattern and category are required' })
  }
  const { data, error } = await supabase
    .from('merchant_rules')
    .upsert({
      workspace_id: req.user.user_metadata.workspaceId,
      pattern: pattern.trim(),
      match_type: match_type || 'contains',
      category,
      is_joint: is_joint ?? null,
      priority: priority || 0,
      auto_learned: auto_learned || false
    }, { onConflict: 'workspace_id,pattern,match_type' })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Update a rule
rulesRouter.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('merchant_rules')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Delete a rule
rulesRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('merchant_rules')
    .delete()
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ success: true })
})

// Apply rules to a list of transactions (used by import)
rulesRouter.post('/apply', async (req, res) => {
  const { transactions } = req.body
  const workspaceId = req.user.user_metadata.workspaceId

  const { data: rules } = await supabase
    .from('merchant_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('priority', { ascending: false })

  if (!rules?.length) return res.json({ transactions })

  const applied = transactions.map(tx => {
    for (const rule of rules) {
      const desc = (tx.description || '').toLowerCase()
      const pattern = rule.pattern.toLowerCase()
      let matches = false
      if (rule.match_type === 'exact')       matches = desc === pattern
      if (rule.match_type === 'starts_with') matches = desc.startsWith(pattern)
      if (rule.match_type === 'contains')    matches = desc.includes(pattern)
      if (matches) {
        return {
          ...tx,
          category: rule.category,
          ...(rule.is_joint !== null && rule.is_joint !== undefined
            ? { is_joint: rule.is_joint } : {})
        }
      }
    }
    return tx
  })

  res.json({ transactions: applied, rules_applied: rules.length })
})

// Learn from a manual category change — check if we should suggest a rule
rulesRouter.post('/learn', async (req, res) => {
  const { description, category, is_joint } = req.body
  const workspaceId = req.user.user_metadata.workspaceId
  if (!description || !category) return res.json({ suggest: false })

  // Check how many transactions with this description share this category
  const normalised = description.toLowerCase().trim()

  // Extract a clean merchant name (first 3+ word tokens, strip trailing noise)
  const words = normalised.split(/\s+/).filter(w => w.length > 1)
  const pattern = words.slice(0, 3).join(' ')

  const { data: matching } = await supabase
    .from('transactions')
    .select('category')
    .eq('workspace_id', workspaceId)
    .ilike('description', `%${pattern}%`)

  if (!matching?.length) return res.json({ suggest: false })

  const sameCategory = matching.filter(t => t.category === category).length
  const ratio = sameCategory / matching.length

  // Suggest a rule if 80%+ of matching transactions share this category
  // and there are at least 2 examples
  const suggest = ratio >= 0.8 && matching.length >= 2

  res.json({
    suggest,
    pattern,
    category,
    is_joint,
    match_type: 'contains',
    confidence: Math.round(ratio * 100),
    sample_count: matching.length
  })
})
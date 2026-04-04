import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { sendEmail, settlementEmail } from '../services/mailer.js'

export const splitRouter = Router()
splitRouter.use(requireAuth)

// Current unsettled joint balance
splitRouter.get('/balance', async (req, res) => {
  const workspaceId = req.user.user_metadata.workspaceId

  const { data, error } = await supabase
    .from('transactions')
    .select('amount, type, created_by, accounts(name)')
    .eq('workspace_id', workspaceId)
    .eq('is_joint', true)
    .eq('settled', false)

  if (error) return res.status(400).json({ error: error.message })

  // Tally by user
  const paid = {}
  data.forEach(t => {
    if (t.type === 'expense') {
      paid[t.created_by] = (paid[t.created_by] || 0) + t.amount
    }
  })

  const userIds = Object.keys(paid)
  const total = Object.values(paid).reduce((s, v) => s + v, 0)
  const fair = total / 2

  const balances = userIds.map(uid => ({
    userId: uid,
    paid: paid[uid] || 0,
    owes: fair - (paid[uid] || 0)
  }))

  res.json({ total, fair, balances, transactions: data })
})

// Settle up — marks all joint unsettled transactions as settled
splitRouter.post('/settle', async (req, res) => {
  const { amount, notes, partnerEmail, partnerName, settlerName } = req.body
  const workspaceId = req.user.user_metadata.workspaceId

  const { data, error } = await supabase
    .from('transactions')
    .update({ settled: true, settled_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('is_joint', true)
    .eq('settled', false)
    .select()

  if (error) return res.status(400).json({ error: error.message })

  // Log the settlement
  await supabase.from('settlements').insert({
    workspace_id: workspaceId,
    settled_by: req.user.id,
    amount,
    notes: notes || null,
    transaction_count: data.length
  })

  // Email partner
  if (partnerEmail) {
    const emailContent = settlementEmail({ partnerName, amount, settledBy: settlerName })
    await sendEmail({ to: partnerEmail, ...emailContent }).catch(() => {})
  }

  res.json({ settled: data.length, amount })
})

// Settlement history
splitRouter.get('/history', async (req, res) => {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

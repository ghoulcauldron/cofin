import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

export const budgetsRouter = Router()
budgetsRouter.use(requireAuth)

budgetsRouter.get('/', async (req, res) => {
  const { year } = req.query
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .eq('year', year || new Date().getFullYear())
    .order('category')
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

budgetsRouter.post('/', async (req, res) => {
  const { category, amount, year, month, is_recurring } = req.body
  const { data, error } = await supabase
    .from('budgets')
    .upsert({
      workspace_id: req.user.user_metadata.workspaceId,
      category,
      amount,
      year: year || new Date().getFullYear(),
      month: month || null,
      is_recurring: is_recurring ?? true
    }, { onConflict: 'workspace_id,category,year,month' })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

budgetsRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ success: true })
})

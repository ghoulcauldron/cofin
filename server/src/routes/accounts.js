import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

export const accountsRouter = Router()
accountsRouter.use(requireAuth)

accountsRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order('created_at', { ascending: true })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

accountsRouter.post('/', async (req, res) => {
  const { name, type, institution, last_four, currency, is_joint } = req.body
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      workspace_id: req.user.user_metadata.workspaceId,
      name, type, institution,
      last_four: last_four || null,
      currency: currency || 'USD',
      is_joint: is_joint || false
    })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

accountsRouter.patch('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('accounts')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

accountsRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ success: true })
})

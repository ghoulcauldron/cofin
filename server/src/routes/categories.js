import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { requireAuth } from '../middleware/auth.js'

export const categoriesRouter = Router()
categoriesRouter.use(requireAuth)

// Get all categories for workspace
categoriesRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order('sort_order', { ascending: true })
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Create a new category
categoriesRouter.post('/', async (req, res) => {
  const { name, type, color } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .ilike('name', name.trim())
    .single()

  if (existing) return res.status(409).json({ error: 'Category already exists' })

  // Get current max sort_order
  const { data: maxRow } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { data, error } = await supabase
    .from('categories')
    .insert({
      workspace_id: req.user.user_metadata.workspaceId,
      name: name.trim(),
      type: type || 'expense',
      color: color || null,
      sort_order: (maxRow?.sort_order || 0) + 1,
      is_system: false
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Update a category name or type
categoriesRouter.patch('/:id', async (req, res) => {
  const { name, type, color, sort_order } = req.body

  // Prevent renaming system categories
  const { data: cat } = await supabase
    .from('categories')
    .select('is_system')
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .single()

  if (!cat) return res.status(404).json({ error: 'Category not found' })
  if (cat.is_system && name) return res.status(403).json({ error: 'System categories cannot be renamed' })

  const updates = {}
  if (name) updates.name = name.trim()
  if (type) updates.type = type
  if (color !== undefined) updates.color = color
  if (sort_order !== undefined) updates.sort_order = sort_order

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Delete a category (non-system only)
categoriesRouter.delete('/:id', async (req, res) => {
  const { data: cat } = await supabase
    .from('categories')
    .select('is_system, name')
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .single()

  if (!cat) return res.status(404).json({ error: 'Category not found' })
  if (cat.is_system) return res.status(403).json({ error: 'System categories cannot be deleted' })

  // Reassign transactions using this category to Uncategorized
  await supabase
    .from('transactions')
    .update({ category: 'Uncategorized' })
    .eq('workspace_id', req.user.user_metadata.workspaceId)
    .eq('category', cat.name)

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', req.params.id)
    .eq('workspace_id', req.user.user_metadata.workspaceId)

  if (error) return res.status(400).json({ error: error.message })
  res.json({ success: true })
})
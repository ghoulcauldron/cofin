import { Router } from 'express'
import { supabase } from '../services/supabase.js'

export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  const { email, password, name } = req.body
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  })
  if (error) return res.status(400).json({ error: error.message })

  // Create workspace for this user
  const { data: workspace } = await supabase
    .from('workspaces')
    .insert({ name: `${name}'s workspace`, owner_id: data.user.id })
    .select()
    .single()

  // Update user with workspace id
  await supabase.auth.admin.updateUserById(data.user.id, {
    user_metadata: { name, workspaceId: workspace.id }
  })

  res.json({ user: data.user, workspaceId: workspace.id })
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: error.message })
  res.json({ session: data.session, user: data.user })
})

authRouter.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) await supabase.auth.admin.signOut(token)
  res.json({ success: true })
})

// Invite a partner to share a workspace
authRouter.post('/invite-partner', async (req, res) => {
  const { email, workspaceId } = req.body
  const { data, error } = await supabase
    .from('workspace_invites')
    .insert({ workspace_id: workspaceId, invited_email: email })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json({ invite: data })
})

// Accept invite and join workspace
authRouter.post('/accept-invite', async (req, res) => {
  const { inviteId, userId } = req.body
  const { data: invite } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('id', inviteId)
    .single()
  if (!invite) return res.status(404).json({ error: 'Invite not found' })

  await supabase.from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: userId
  })
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { workspaceId: invite.workspace_id }
  })
  await supabase.from('workspace_invites').delete().eq('id', inviteId)

  res.json({ workspaceId: invite.workspace_id })
})

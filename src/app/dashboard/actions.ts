'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { FREE_TIER_LIMITS } from '@/lib/constants'

export type ActionResult = {
  success?: boolean
  error?: string
  isLimitReached?: boolean
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    return { error: 'Project name is required.' }
  }

  const { count, error: countError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', user.id)

  if (countError) {
    return { error: 'Failed to verify project count limits.' }
  }

  if (count !== null && count >= FREE_TIER_LIMITS.MAX_PROJECTS) {
    return {
      error: `Free tier limit reached: You can create a maximum of ${FREE_TIER_LIMITS.MAX_PROJECTS} projects. Upgrade to add more.`,
      isLimitReached: true,
    }
  }

  const { error: insertError } = await supabase.from('projects').insert({
    name,
    owner_id: user.id,
  })

  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateProject(projectId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    return { error: 'Project name is required.' }
  }

  const { error } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', projectId)
    .eq('owner_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('owner_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function createMonitor(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const projectId = formData.get('projectId') as string
  const name = (formData.get('name') as string)?.trim()
  let url = (formData.get('url') as string)?.trim()
  const intervalStr = formData.get('checkIntervalMinutes') as string
  const interval = parseInt(intervalStr || '5', 10)

  if (!projectId || !name || !url) {
    return { error: 'Project, monitor name, and URL are required.' }
  }

  // Prepend https:// if user omitted protocol
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  try {
    new URL(url)
  } catch {
    return { error: 'Please enter a valid URL (e.g. https://example.com).' }
  }

  // Verify ownership of project
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_id', user.id)
    .single()

  if (!project) {
    return { error: 'Project not found or access denied.' }
  }

  // Check monitor count limit for this project.
  const { count, error: countError } = await supabase
    .from('monitors')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)

  if (countError) {
    return { error: 'Failed to verify monitor count limits.' }
  }

  if (count !== null && count >= FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT) {
    return {
      error: `Free tier limit reached: You can create a maximum of ${FREE_TIER_LIMITS.MAX_MONITORS_PER_PROJECT} monitors per project. Upgrade to add more.`,
      isLimitReached: true,
    }
  }

  const { error: insertError } = await supabase.from('monitors').insert({
    project_id: projectId,
    name,
    url,
    check_interval_minutes: interval,
    type: 'http',
    status: 'unmonitored',
    is_active: true,
  })

  if (insertError) {
    return { error: insertError.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateMonitor(monitorId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const name = (formData.get('name') as string)?.trim()
  let url = (formData.get('url') as string)?.trim()
  const intervalStr = formData.get('checkIntervalMinutes') as string
  const interval = parseInt(intervalStr || '5', 10)

  if (!name || !url) {
    return { error: 'Monitor name and URL are required.' }
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  try {
    new URL(url)
  } catch {
    return { error: 'Please enter a valid URL.' }
  }

  const { error } = await supabase
    .from('monitors')
    .update({
      name,
      url,
      check_interval_minutes: interval,
    })
    .eq('id', monitorId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function toggleMonitorActive(monitorId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const newStatus = isActive ? 'unmonitored' : 'paused'

  const { error } = await supabase
    .from('monitors')
    .update({
      is_active: isActive,
      status: newStatus,
    })
    .eq('id', monitorId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteMonitor(monitorId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required.' }
  }

  const { error } = await supabase
    .from('monitors')
    .delete()
    .eq('id', monitorId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

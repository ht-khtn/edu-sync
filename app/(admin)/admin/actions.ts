'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getServerAuthContext, getServerRoles, summarizeRoles } from '@/lib/server-auth'
import { hasAdminManagementAccess } from '@/lib/admin-access'

async function requireSystemAccess() {
  const { supabase, appUserId } = await getServerAuthContext()
  if (!appUserId) redirect('/login')
  const summary = summarizeRoles(await getServerRoles())
  if (!hasAdminManagementAccess(summary)) redirect('/admin')
  return { supabase, appUserId }
}

function normalizeString(value: FormDataEntryValue | null): string | null {
  if (!value) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function parseBooleanInput(value: FormDataEntryValue | null, fallback = true) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true
  if (['false', '0', 'off', 'no'].includes(normalized)) return false
  return fallback
}

const CRITERIA_CATEGORY_VALUES = ['student', 'class'] as const
const CRITERIA_TYPE_VALUES = ['normal', 'serious', 'critical'] as const

const criteriaFormSchema = z.object({
  name: z.string().min(3).max(160).transform((val) => val.trim()),
  description: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null
      const text = val.trim()
      return text.length > 0 ? text : null
    }),
  score: z.coerce.number().int().positive(),
  category: z.enum(CRITERIA_CATEGORY_VALUES),
  type: z.enum(CRITERIA_TYPE_VALUES),
  group: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null
      const text = val.trim()
      return text.length > 0 ? text : null
    }),
  subgroup: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return null
      const text = val.trim()
      return text.length > 0 ? text : null
    }),
})

export async function createAccountAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const email = normalizeString(formData.get('email'))
  const usernameInput = normalizeString(formData.get('username'))
  const fullName = normalizeString(formData.get('fullName'))
  const classId = normalizeString(formData.get('classId'))

  if (!email) return redirect('/admin/accounts?error=missing')

  const username = usernameInput ?? email.split('@')[0] ?? null

  // Step 1: Create auth user via admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(2, 15), // Generate random password
    email_confirm: true,
    user_metadata: { created_by: 'admin' },
  })

  if (authError || !authData?.user?.id) {
    return redirect('/admin/accounts?error=auth-create')
  }

  const authUid = authData.user.id

  // Step 2: Trigger will create public.users row automatically
  // Wait a moment for trigger to complete
  await new Promise(resolve => setTimeout(resolve, 500))

  // Step 3: Update the created public.users row with username and class
  const { data: users, error: lookupError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_uid', authUid)
    .single()

  if (lookupError || !users?.id) {
    return redirect('/admin/accounts?error=lookup')
  }

  const userId = users.id

  // Step 4: Update user with username and class (parallelize operations)
  const updatePromise = supabase
    .from('users')
    .update({
      user_name: username,
      class_id: classId,
    })
    .eq('id', userId)

  const auditPromise = supabase.from('audit_logs').insert({
    table_name: 'users',
    record_id: userId,
    action: 'INSERT',
    actor_id: appUserId,
    diff: { email, user_name: username, class_id: classId, auth_uid: authUid },
    meta: { type: 'admin-create-user' },
  })

  const profilePromise = fullName
    ? supabase
        .from('user_profiles')
        .upsert({ user_id: userId, full_name: fullName })
    : Promise.resolve(null)

  await Promise.all([updatePromise, auditPromise, profilePromise])

  revalidatePath('/admin/accounts')
  return redirect('/admin/accounts?ok=1')
}

export async function assignRoleAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const userId = normalizeString(formData.get('userId'))
  const roleId = normalizeString(formData.get('roleId'))
  const target = normalizeString(formData.get('target'))

  if (!userId || !roleId) return redirect('/admin/roles?error=missing')

  const { data, error } = await supabase
    .from('user_roles')
    .upsert(
      {
        user_id: userId,
        role_id: roleId.toUpperCase(),
        target: target,
      },
      { onConflict: 'user_id' }
    )
    .select('id')
    .single()

  if (error) {
    return redirect('/admin/roles?error=insert')
  }

  await supabase.from('audit_logs').insert({
    table_name: 'user_roles',
    record_id: data?.id ?? null,
    action: 'UPSERT',
    actor_id: appUserId,
    diff: { role_id: roleId.toUpperCase(), target },
    meta: { type: 'assign-role' },
  })

  revalidatePath('/admin/roles')
  return redirect('/admin/roles?ok=1')
}

export async function removeRoleAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const roleRecordId = normalizeString(formData.get('roleRecordId'))

  if (!roleRecordId) return redirect('/admin/roles?error=missing')

  // Get role info before deletion for audit
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('user_id, role_id, target')
    .eq('id', roleRecordId)
    .maybeSingle()

  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('id', roleRecordId)

  if (error) {
    return redirect('/admin/roles?error=delete')
  }

  await supabase.from('audit_logs').insert({
    table_name: 'user_roles',
    record_id: roleRecordId,
    action: 'DELETE',
    actor_id: appUserId,
    diff: roleData ? { user_id: roleData.user_id, role_id: roleData.role_id, target: roleData.target } : null,
    meta: { type: 'remove-role' },
  })

  revalidatePath('/admin/roles')
  return redirect('/admin/roles?ok=1')
}

export async function createClassAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const name = normalizeString(formData.get('className'))
  const gradeId = normalizeString(formData.get('gradeId'))
  const homeroomTeacherId = normalizeString(formData.get('homeroomTeacherId'))

  if (!name || !gradeId) return redirect('/admin/classes?error=missing')

  const { data, error } = await supabase
    .from('classes')
    .insert({
      name,
      grade_id: gradeId,
      homeroom_teacher_id: homeroomTeacherId,
    })
    .select('id')
    .single()

  if (error) return redirect('/admin/classes?error=insert')

  await supabase.from('audit_logs').insert({
    table_name: 'classes',
    record_id: data?.id ?? null,
    action: 'INSERT',
    actor_id: appUserId,
    diff: { name, grade_id: gradeId, homeroom_teacher_id: homeroomTeacherId },
    meta: { type: 'create-class' },
  })

  revalidatePath('/admin/classes')
  return redirect('/admin/classes?ok=1')
}

export async function updateHomeroomAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const classId = normalizeString(formData.get('classId'))
  const homeroomTeacherId = normalizeString(formData.get('homeroomTeacherId'))

  if (!classId) return redirect('/admin/classes?error=missing')

  const { error } = await supabase
    .from('classes')
    .update({ homeroom_teacher_id: homeroomTeacherId })
    .eq('id', classId)

  if (error) return redirect('/admin/classes?error=insert')

  await supabase.from('audit_logs').insert({
    table_name: 'classes',
    record_id: classId,
    action: 'UPDATE',
    actor_id: appUserId,
    diff: { homeroom_teacher_id: homeroomTeacherId },
    meta: { type: 'update-homeroom' },
  })

  revalidatePath('/admin/classes')
  return redirect('/admin/classes?ok=1')
}

export async function createCriteriaAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const parsed = criteriaFormSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    score: formData.get('score'),
    category: formData.get('category'),
    type: formData.get('type'),
    group: formData.get('group'),
    subgroup: formData.get('subgroup'),
  })

  if (!parsed.success) {
    return redirect('/admin/criteria?error=missing')
  }

  const payload = parsed.data
  const { data, error } = await supabase
    .from('criteria')
    .insert({
      name: payload.name,
      description: payload.description,
      score: payload.score,
      category: payload.category,
      type: payload.type,
      group: payload.group,
      subgroup: payload.subgroup,
      is_active: true,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    return redirect('/admin/criteria?error=insert')
  }

  await supabase.from('audit_logs').insert({
    table_name: 'criteria',
    record_id: data?.id ?? null,
    action: 'INSERT',
    actor_id: appUserId,
    diff: payload,
    meta: { type: 'create-criteria' },
  })

  revalidatePath('/admin/criteria')
  return redirect('/admin/criteria?ok=criteria-created')
}

export async function updateCriteriaAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const parsed = criteriaFormSchema
    .extend({ id: z.string().uuid() })
    .safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      description: formData.get('description'),
      score: formData.get('score'),
      category: formData.get('category'),
      type: formData.get('type'),
      group: formData.get('group'),
      subgroup: formData.get('subgroup'),
    })

  if (!parsed.success) {
    return redirect('/admin/criteria?error=missing')
  }

  const isActive = parseBooleanInput(formData.get('isActive'), true)
  const payload = parsed.data

  const { error } = await supabase
    .from('criteria')
    .update({
      name: payload.name,
      description: payload.description,
      score: payload.score,
      category: payload.category,
      type: payload.type,
      group: payload.group,
      subgroup: payload.subgroup,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.id)

  if (error) {
    return redirect('/admin/criteria?error=update')
  }

  await supabase.from('audit_logs').insert({
    table_name: 'criteria',
    record_id: payload.id,
    action: 'UPDATE',
    actor_id: appUserId,
    diff: { ...payload, is_active: isActive },
    meta: { type: 'update-criteria' },
  })

  revalidatePath('/admin/criteria')
  return redirect('/admin/criteria?ok=criteria-updated')
}

export async function toggleCriteriaStatusAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const id = normalizeString(formData.get('id'))
  const status = normalizeString(formData.get('status'))
  if (!id || !status) return redirect('/admin/criteria?error=missing')

  const enable = status === 'enable'
  const { error } = await supabase
    .from('criteria')
    .update({ is_active: enable, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return redirect('/admin/criteria?error=update')

  await supabase.from('audit_logs').insert({
    table_name: 'criteria',
    record_id: id,
    action: 'UPDATE',
    actor_id: appUserId,
    diff: { is_active: enable },
    meta: { type: enable ? 'enable-criteria' : 'disable-criteria' },
  })

  revalidatePath('/admin/criteria')
  return redirect(`/admin/criteria?ok=${enable ? 'criteria-restored' : 'criteria-disabled'}`)
}

export async function deleteCriteriaAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const id = normalizeString(formData.get('id'))
  if (!id) return redirect('/admin/criteria?error=missing')

  const { count, error: countError } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('criteria_id', id)

  if (countError) return redirect('/admin/criteria?error=delete')

  if ((count ?? 0) > 0) {
    const { error: disableError } = await supabase
      .from('criteria')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (disableError) return redirect('/admin/criteria?error=delete')

    await supabase.from('audit_logs').insert({
      table_name: 'criteria',
      record_id: id,
      action: 'UPDATE',
      actor_id: appUserId,
      diff: { is_active: false },
      meta: { type: 'disable-criteria', reason: 'has-records' },
    })

    revalidatePath('/admin/criteria')
    return redirect('/admin/criteria?ok=criteria-disabled')
  }

  const { error: deleteError } = await supabase.from('criteria').delete().eq('id', id)
  if (deleteError) return redirect('/admin/criteria?error=delete')

  await supabase.from('audit_logs').insert({
    table_name: 'criteria',
    record_id: id,
    action: 'DELETE',
    actor_id: appUserId,
    diff: { id },
    meta: { type: 'delete-criteria' },
  })

  revalidatePath('/admin/criteria')
  return redirect('/admin/criteria?ok=criteria-deleted')
}

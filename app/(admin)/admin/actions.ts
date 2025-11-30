'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
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

export async function createAccountAction(formData: FormData) {
  const { supabase, appUserId } = await requireSystemAccess()
  const email = normalizeString(formData.get('email'))
  const usernameInput = normalizeString(formData.get('username'))
  const fullName = normalizeString(formData.get('fullName'))
  const classId = normalizeString(formData.get('classId'))

  if (!email) return redirect('/admin/accounts?error=missing')

  const username = usernameInput ?? email.split('@')[0] ?? null

  const { data: insertedUser, error } = await supabase
    .from('users')
    .insert({
      email,
      user_name: username,
      class_id: classId,
    })
    .select('id')
    .single()

  if (error || !insertedUser?.id) {
    return redirect('/admin/accounts?error=insert')
  }

  if (fullName) {
    await supabase
      .from('user_profiles')
      .upsert({ user_id: insertedUser.id, full_name: fullName })
  }

  await supabase.from('audit_logs').insert({
    table_name: 'users',
    record_id: insertedUser.id,
    action: 'INSERT',
    actor_id: appUserId,
    diff: { email, user_name: username, class_id: classId },
    meta: { type: 'admin-create-user' },
  })

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

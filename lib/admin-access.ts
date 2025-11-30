import type { RoleSummary } from '@/lib/server-auth'

const MANAGEMENT_ROLES = new Set(['AD', 'MOD'])

export function hasAdminManagementAccess(summary: RoleSummary): boolean {
  return summary.roleIds.some((roleId) => MANAGEMENT_ROLES.has(roleId))
}

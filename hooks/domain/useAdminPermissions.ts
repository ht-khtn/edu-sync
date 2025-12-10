"use client"

import { useUser } from "../useUser"

export type AdminPermissions = {
  canEnterViolations: boolean
  canViewViolationStats: boolean
  canManageSystem: boolean
  hasOlympiaAccess: boolean
  isLoading: boolean
}

/**
 * Hook to get admin permissions derived from user roles
 * Centralizes role check logic in one place
 */
export function useAdminPermissions(): AdminPermissions {
  const { user, isLoading } = useUser()

  // Derive permissions from roles
  const hasCC = user?.hasCC || false
  const hasMOD = user?.roles?.includes('MOD') || false
  const hasSEC = user?.roles?.includes('SEC') || false
  const hasAD = user?.roles?.includes('AD') || false
  const hasSchoolScope = user?.hasSchoolScope || false
  const hasOlympiaAccess = user?.hasOlympiaAccess || false

  return {
    canEnterViolations: hasCC || hasMOD || hasSEC,
    canViewViolationStats: hasSchoolScope || hasMOD || hasAD,
    canManageSystem: hasAD || hasMOD,
    hasOlympiaAccess,
    isLoading,
  }
}

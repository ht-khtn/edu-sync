"use client"

import { useSession } from './useSession'

export type UserInfo = {
  id: string
  hasCC: boolean
  hasSchoolScope: boolean
  ccClassId: string | null
  roles: string[]
}

export type UseUserResult = {
  user: UserInfo | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to get current user info with roles
 * Built on top of useSession
 */
export function useUser(): UseUserResult {
  const { data, isLoading, isError, error, refetch } = useSession()

  if (!data?.user) {
    return {
      user: null,
      isLoading,
      isError,
      error,
      refetch,
    }
  }

  const user: UserInfo = {
    id: data.user.id,
    hasCC: data.hasCC ?? false,
    hasSchoolScope: data.hasSchoolScope ?? false,
    ccClassId: data.ccClassId ?? null,
    roles: data.roles ?? [],
  }

  return {
    user,
    isLoading,
    isError,
    error,
    refetch,
  }
}

import { redirect } from 'next/navigation'
import { summarizeOlympiaRole } from '@/lib/olympia-access'
import { getServerAuthContext } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export default async function OlympiaLandingRedirect() {
  const { appUserId } = await getServerAuthContext()
  
  // If not authenticated, redirect to login
  if (!appUserId) {
    return redirect('/login?redirect=/olympia')
  }

  const role = await summarizeOlympiaRole()

  if (role === 'olympia-admin') {
    redirect('/olympia/admin')
  }

  if (role === 'olympia-mc') {
    redirect('/olympia/mc')
  }

  redirect('/olympia/client')
}

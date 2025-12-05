import { redirect } from 'next/navigation'
import { summarizeOlympiaRole } from '@/lib/olympia-access'

export const dynamic = 'force-dynamic'

export default async function OlympiaLandingRedirect() {
  const role = await summarizeOlympiaRole()

  if (role === 'olympia-admin') {
    redirect('/olympia/admin')
  }

  if (role === 'olympia-mc') {
    redirect('/olympia/mc')
  }

  redirect('/olympia/client')
}

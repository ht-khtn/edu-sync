import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ScoreEntryPage() {
  // temporarily hide/remove the score entry page by redirecting to admin dashboard
  redirect('/admin')
}

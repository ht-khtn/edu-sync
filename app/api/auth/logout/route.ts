import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST() {
  try {
    const resp = NextResponse.json({ ok: true })
    // clear cookies used for server auth
    resp.cookies.set('sb-access-token', '', { path: '/', maxAge: 0 })
    resp.cookies.set('sb-refresh-token', '', { path: '/', maxAge: 0 })

    try {
      const supabase = await getSupabaseServer()
      // best-effort sign out on server
      await supabase.auth.signOut()
    } catch (e) {
      // ignore
    }

    return resp
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

export const runtime = 'edge'

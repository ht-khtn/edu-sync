import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EDGE_FN_URL = process.env.RECORD_OPS_FN_URL // set this to your deployed Edge Function URL

// Avoid throwing at module initialization (this breaks Next.js build/prerender).
// Create Supabase admin client lazily inside the request handler so missing
// env vars produce runtime errors instead of build-time exceptions.
if (!SUPABASE_URL) {
  console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL not set. Some features may fail at runtime.')
}

if (!SERVICE_KEY) {
  // We allow absence during local dev, but the route will fail if used without it
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY not set. Token verification will fail.')
}

let _supabaseAdmin: ReturnType<typeof createClient> | null = null


export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')

    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

    // create admin client lazily so we don't rely on env at build time
    let supabaseAdmin = _supabaseAdmin
    if (!supabaseAdmin) {
      if (!SUPABASE_URL || !SERVICE_KEY) {
        return NextResponse.json({ error: 'Server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
      }
      supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY)
      _supabaseAdmin = supabaseAdmin
    }

    // verify token with Supabase admin client
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const actor_id = userData.user.id

    const body = await req.json()
    const { action, record, id } = body
    if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

    if (!EDGE_FN_URL) {
      // If Edge Function URL missing, optionally call DB directly using service key
      return NextResponse.json({ error: 'Edge function URL not configured (RECORD_OPS_FN_URL)' }, { status: 500 })
    }

    // Forward to Edge Function, include actor_id
    const resp = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, record, id, actor_id })
    })

    const payload = await resp.text()
    const contentType = resp.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    return new NextResponse(isJson ? payload : payload, { status: resp.status, headers: { 'Content-Type': resp.headers.get('content-type') || 'text/plain' } })
  } catch (err: any) {
    console.error('record-ops API error', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

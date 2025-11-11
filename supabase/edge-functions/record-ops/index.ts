// @ts-nocheck

// Supabase Edge Function (Deno) — record-ops
// This function performs record insert/update/approve using the SERVICE ROLE KEY
// and writes explicit audit entries including the actor_id provided by the caller.
// Deploy this on Supabase Edge Functions and call it from your server or trusted clients.

import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function environment')
}

async function insertRecord(record: any, actor_id: string) {
  // Insert into records
  const res = await fetch(`${SUPABASE_URL}/rest/v1/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(record)
  })
  const data = await res.json()

  // Insert explicit audit log with actor_id
  const audit = {
    table_name: 'records',
    record_id: Array.isArray(data) && data[0] ? String(data[0].id) : null,
    action: 'INSERT',
    actor_id: actor_id,
    diff: data && data[0] ? data[0] : record
  }
  await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify(audit)
  })

  return data
}

async function approveRecord(id: string, actor_id: string, update: any) {
  // update record (e.g., set status = 'approved', approved_by = actor_id)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/records?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify(update)
  })
  const data = await res.json()

  // insert audit log
  const audit = {
    table_name: 'records',
    record_id: id,
    action: 'APPROVE',
    actor_id: actor_id,
    diff: data && data[0] ? data[0] : update
  }
  await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify(audit)
  })

  return data
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const body = await req.json()
    const { action, record, id, actor_id } = body

    if (!actor_id) return new Response('Missing actor_id', { status: 400 })

    if (action === 'insert') {
      const inserted = await insertRecord(record, actor_id)
      return new Response(JSON.stringify({ success: true, data: inserted }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (action === 'approve') {
      if (!id) return new Response('Missing id for approve', { status: 400 })
      const updated = await approveRecord(id, actor_id, { status: 'approved', approved_by: actor_id })
      return new Response(JSON.stringify({ success: true, data: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('Unknown action', { status: 400 })
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

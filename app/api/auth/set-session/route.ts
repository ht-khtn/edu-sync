import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { access_token, refresh_token, expires_in } = body
    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing tokens' }, { status: 400 })
    }

    const resp = NextResponse.json({ ok: true })

    // Set access token (short-lived)
    resp.cookies.set('sb-access-token', access_token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: typeof expires_in === 'number' && expires_in > 0 ? expires_in : 60 * 60,
    })

    // Set refresh token (longer lived)
    resp.cookies.set('sb-refresh-token', refresh_token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return resp
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}

export const runtime = 'edge'

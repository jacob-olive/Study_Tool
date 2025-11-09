import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { encrypt } from '@/lib/canvas'

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { baseUrl, pat } = await req.json()
  if (!baseUrl || !pat) {
    return NextResponse.json({ error: 'Missing baseUrl or pat' }, { status: 400 })
  }

  // Validate the PAT by making a test API call
  try {
    const testRes = await fetch(`${baseUrl}/api/v1/users/self/profile`, {
      headers: { Authorization: `Bearer ${pat}` },
      cache: 'no-store'
    })
    if (!testRes.ok) {
      return NextResponse.json({ error: 'Invalid PAT or Canvas URL' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to validate PAT' }, { status: 400 })
  }

  // Encrypt and save the PAT
  const payload = {
    token: encrypt(JSON.stringify({
      access_token: pat,
      obtained_at: Date.now()
    })),
    baseUrl: baseUrl,
    updatedAt: Date.now()
  }

  await adminDb.doc(`users/${user.uid}/private/canvas`).set(payload, { merge: true })

  return NextResponse.json({ ok: true })
}


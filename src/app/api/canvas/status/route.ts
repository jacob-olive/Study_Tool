import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ connected: false })

  const privSnap = await adminDb.doc(`users/${user.uid}/private/canvas`).get()
  if (!privSnap.exists) {
    return NextResponse.json({ connected: false })
  }

  const { baseUrl } = privSnap.data() as any
  return NextResponse.json({ connected: true, baseUrl })
}


import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ uid: user.uid })
}


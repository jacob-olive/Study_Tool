import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const associationType = searchParams.get('associationType')
    const associationId = searchParams.get('associationId')

    let query = adminDb.collection(`users/${user.uid}/study-guides`)

    if (associationType) {
      query = query.where('associationType', '==', associationType) as any
    }
    if (associationId) {
      query = query.where('associationId', '==', associationId) as any
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get()
    const guides = snapshot.docs.map(doc => doc.data())

    return NextResponse.json({
      ok: true,
      guides,
    })
  } catch (error: any) {
    console.error('Error listing study guides:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list study guides' },
      { status: 500 }
    )
  }
}


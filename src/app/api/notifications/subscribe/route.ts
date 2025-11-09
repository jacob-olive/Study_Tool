import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { subscription } = await req.json()

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    // Store push subscription
    const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').slice(0, 32)
    await adminDb.doc(`users/${user.uid}/push-subscriptions/${subscriptionId}`).set({
      subscription,
      createdAt: Date.now(),
    })

    return NextResponse.json({
      ok: true,
      message: 'Push subscription registered',
    })
  } catch (error: any) {
    console.error('Error registering push subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to register subscription' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { endpoint } = await req.json()

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    const subscriptionId = Buffer.from(endpoint).toString('base64').slice(0, 32)
    await adminDb.doc(`users/${user.uid}/push-subscriptions/${subscriptionId}`).delete()

    return NextResponse.json({
      ok: true,
      message: 'Push subscription removed',
    })
  } catch (error: any) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove subscription' },
      { status: 500 }
    )
  }
}


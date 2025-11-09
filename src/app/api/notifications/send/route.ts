import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import webpush from 'web-push'
import { sendNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { type, title, message, link } = await req.json()

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Type, title, and message are required' },
        { status: 400 }
      )
    }

    await sendNotification({
      userId: user.uid,
      type: type as 'session-reminder' | 'deadline-alert' | 'study-plan-update',
      title,
      message,
      link,
    })

    return NextResponse.json({
      ok: true,
      message: 'Notification sent',
    })
  } catch (error: any) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    )
  }
}


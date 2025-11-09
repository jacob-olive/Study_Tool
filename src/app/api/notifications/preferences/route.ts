import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { NotificationPreferencesSchema } from '@/lib/schema'

export async function GET(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userDoc = await adminDb.doc(`users/${user.uid}`).get()
    const prefs = userDoc.data()?.notificationPreferences

    if (!prefs) {
      // Return defaults
      return NextResponse.json({
        ok: true,
        preferences: {
          inApp: true,
          browserPush: false,
          email: false,
          sessionReminders: true,
          deadlineAlerts: true,
          studyPlanUpdates: false,
          reminderTiming: 15, // 15 minutes before
        },
      })
    }

    return NextResponse.json({
      ok: true,
      preferences: prefs,
    })
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const preferences = NotificationPreferencesSchema.parse(body)

    await adminDb.doc(`users/${user.uid}`).set(
      {
        notificationPreferences: preferences,
        updatedAt: Date.now(),
      },
      { merge: true }
    )

    return NextResponse.json({
      ok: true,
      preferences,
    })
  } catch (error: any) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update preferences' },
      { status: 500 }
    )
  }
}


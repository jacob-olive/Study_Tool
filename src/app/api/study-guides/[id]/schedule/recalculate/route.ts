import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { recalculateSchedule } from '@/lib/study-schedule'
import type { Availability } from '@/lib/scheduling'
import type { StudySchedule } from '@/lib/schema'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const guideId = params.id
    const body = await req.json()
    const { dailyStudyMinutes } = body

    // Fetch schedule
    const scheduleRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}/schedule/main`)
    const scheduleSnap = await scheduleRef.get()

    if (!scheduleSnap.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = scheduleSnap.data() as StudySchedule

    // Get user availability
    const userDoc = await adminDb.doc(`users/${user.uid}`).get()
    const userData = userDoc.data()
    const availability = userData?.availability as Availability | undefined

    // Recalculate schedule
    const recalculated = recalculateSchedule(
      schedule,
      availability,
      dailyStudyMinutes || 120
    )

    // Save recalculated schedule
    await scheduleRef.update(recalculated)

    return NextResponse.json({
      ok: true,
      schedule: recalculated,
    })
  } catch (error: any) {
    console.error('Error recalculating schedule:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate schedule' },
      { status: 500 }
    )
  }
}


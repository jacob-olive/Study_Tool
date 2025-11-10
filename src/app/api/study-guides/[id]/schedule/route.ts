import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { generateSchedule, type ScheduleOptions } from '@/lib/study-schedule'
import type { Availability } from '@/lib/scheduling'

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
    const { targetDate, startDate, dailyStudyMinutes } = body

    if (!targetDate) {
      return NextResponse.json({ error: 'Target date is required' }, { status: 400 })
    }

    // Fetch study guide
    const guideRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}`)
    const guideSnap = await guideRef.get()

    if (!guideSnap.exists) {
      return NextResponse.json({ error: 'Study guide not found' }, { status: 404 })
    }

    const guide = guideSnap.data()
    if (!guide?.aiContent || guide.status !== 'ready') {
      return NextResponse.json(
        { error: 'Study guide content not ready' },
        { status: 400 }
      )
    }

    // Get user availability preferences
    const userDoc = await adminDb.doc(`users/${user.uid}`).get()
    const userData = userDoc.data()
    const availability = userData?.availability as Availability | undefined

    // Generate schedule (default to 90 minutes = 1.5 hours per day)
    const options: ScheduleOptions = {
      targetDate,
      startDate,
      dailyStudyMinutes: dailyStudyMinutes || 90,
      availability,
    }

    const schedule = generateSchedule(
      guideId,
      user.uid,
      guide.aiContent,
      options
    )

    // Save schedule to Firestore
    const scheduleRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}/schedule/main`)
    await scheduleRef.set(schedule)

    // Update study guide with schedule reference
    await guideRef.update({
      scheduleId: schedule.id,
      targetDate: targetDate,
      updatedAt: Date.now(),
    })

    return NextResponse.json({
      ok: true,
      schedule,
    })
  } catch (error: any) {
    console.error('Error creating study schedule:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create study schedule' },
      { status: 500 }
    )
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const guideId = params.id

    const scheduleRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}/schedule/main`)
    const scheduleSnap = await scheduleRef.get()

    if (!scheduleSnap.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = scheduleSnap.data()

    return NextResponse.json({
      ok: true,
      schedule,
    })
  } catch (error: any) {
    console.error('Error fetching study schedule:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch study schedule' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { recalculateSchedule } from '@/lib/study-schedule'
import type { Availability } from '@/lib/scheduling'
import type { StudySchedule } from '@/lib/schema'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const { id: guideId, itemId } = params
    const body = await req.json()
    const { completed } = body

    // Fetch schedule
    const scheduleRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}/schedule/main`)
    const scheduleSnap = await scheduleRef.get()

    if (!scheduleSnap.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const schedule = scheduleSnap.data() as StudySchedule

    // Update item completion status
    const updatedItems = schedule.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          completedAt: completed ? Date.now() : null,
        }
      }
      return item
    })

    const updatedSchedule = {
      ...schedule,
      items: updatedItems,
      updatedAt: Date.now(),
    }

    // Save updated schedule
    await scheduleRef.update(updatedSchedule)

    // Recalculate schedule if item was completed
    if (completed) {
      // Get user availability
      const userDoc = await adminDb.doc(`users/${user.uid}`).get()
      const userData = userDoc.data()
      const availability = userData?.availability as Availability | undefined

      const recalculated = recalculateSchedule(
        updatedSchedule,
        availability,
        120 // Default daily study minutes
      )

      await scheduleRef.update(recalculated)
    }

    const finalSchedule = completed
      ? (await scheduleRef.get()).data()
      : updatedSchedule

    return NextResponse.json({
      ok: true,
      schedule: finalSchedule,
    })
  } catch (error: any) {
    console.error('Error updating study item:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update study item' },
      { status: 500 }
    )
  }
}


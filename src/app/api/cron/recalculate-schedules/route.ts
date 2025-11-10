import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { recalculateSchedule } from '@/lib/study-schedule'
import type { Availability, StudySchedule } from '@/lib/schema'

/**
 * Cron job endpoint for daily schedule recalculation
 * Can be triggered manually or via Vercel Cron
 * 
 * To set up Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/recalculate-schedules",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(req: NextRequest) {
  // Optional: Add authentication/authorization check
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    let recalculatedCount = 0
    let errorCount = 0

    // Get all users
    const usersSnapshot = await adminDb.collection('users').get()

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id

      try {
        // Get all study guides with schedules
        const guidesSnapshot = await adminDb
          .collection(`users/${userId}/study-guides`)
          .where('scheduleId', '!=', null)
          .get()

        for (const guideDoc of guidesSnapshot.docs) {
          const guideId = guideDoc.id
          const scheduleRef = adminDb.doc(`users/${userId}/study-guides/${guideId}/schedule/main`)
          const scheduleSnap = await scheduleRef.get()

          if (!scheduleSnap.exists) continue

          const schedule = scheduleSnap.data() as StudySchedule

          // Check if schedule needs recalculation (last recalculated more than 24 hours ago)
          if (schedule.lastRecalculated > oneDayAgo) {
            continue // Skip if recently recalculated
          }

          // Get user availability
          const userData = userDoc.data()
          const availability = userData?.availability as Availability | undefined

          // Recalculate schedule
          const recalculated = recalculateSchedule(
            schedule,
            availability,
            120 // Default daily study minutes
          )

          // Update schedule
          await scheduleRef.update(recalculated)
          recalculatedCount++
        }
      } catch (err) {
        console.error(`Error processing user ${userId}:`, err)
        errorCount++
      }
    }

    return NextResponse.json({
      ok: true,
      recalculated: recalculatedCount,
      errors: errorCount,
      timestamp: now,
    })
  } catch (error: any) {
    console.error('Error in cron job:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate schedules' },
      { status: 500 }
    )
  }
}


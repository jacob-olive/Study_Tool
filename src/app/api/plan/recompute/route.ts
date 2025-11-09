import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { planSessions, type Task, type Availability } from '@/lib/scheduling'
import { scheduleSessionReminder, sendStudyPlanUpdate } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const planRef = adminDb.doc(`users/${user.uid}/plans/active`)
  const [tasksSnap, planSnap, settingsSnap] = await Promise.all([
    planRef.collection('tasks').get(),
    planRef.get(),
    adminDb.doc(`users/${user.uid}`).get()
  ])

  const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[]
  const settings = settingsSnap.exists ? settingsSnap.data() : {}
  
  // Default availability: Weekdays 9 AM - 5 PM, Weekends 10 AM - 4 PM
  const av: Availability = (settings?.availability as Availability | undefined) || {
    timezone: 'UTC',
    weekly: {
      0: [{ start: '10:00', end: '16:00' }], // Sunday
      1: [{ start: '09:00', end: '17:00' }], // Monday
      2: [{ start: '09:00', end: '17:00' }], // Tuesday
      3: [{ start: '09:00', end: '17:00' }], // Wednesday
      4: [{ start: '09:00', end: '17:00' }], // Thursday
      5: [{ start: '09:00', end: '17:00' }], // Friday
      6: [{ start: '10:00', end: '16:00' }], // Saturday
    },
    sessionLengthMinutes: 60,
    bufferMinutes: 10,
  }

  const sessions = planSessions(tasks, av)
  const batch = adminDb.bulkWriter()
  
  // Get task details for notifications
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  
  for (const s of sessions) {
    batch.set(planRef.collection('sessions').doc(s.id), s, { merge: true })
    
    // Schedule session reminder notification
    const task = taskMap.get(s.taskId)
    if (task) {
      scheduleSessionReminder(
        s.id,
        user.uid,
        task.title,
        new Date(s.startsAt)
      ).catch(err => {
        console.error('Error scheduling session reminder:', err)
      })
    }
  }
  await batch.close()
  await planRef.set({ updatedAt: Date.now() }, { merge: true })

  // Send study plan update notification
  sendStudyPlanUpdate(user.uid).catch(err => {
    console.error('Error sending study plan update notification:', err)
  })

  return NextResponse.json({ ok: true, sessions: sessions.length })
}


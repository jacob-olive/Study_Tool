import { adminDb } from '@/lib/firebase/admin'
import webpush from 'web-push'
import type { NotificationPreferences, Notification } from '@/lib/schema'
import { v4 as uuidv4 } from 'uuid'

// Initialize web-push with VAPID keys (if configured)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

type SendNotificationParams = {
  userId: string
  type: 'session-reminder' | 'deadline-alert' | 'study-plan-update'
  title: string
  message: string
  link?: string
}

export async function sendNotification(params: SendNotificationParams) {
  const { userId, type, title, message, link } = params

  // Get user notification preferences
  const userDoc = await adminDb.doc(`users/${userId}`).get()
  const prefs = userDoc.data()?.notificationPreferences as NotificationPreferences | undefined

  if (!prefs) {
    // Default preferences
    return
  }

  // Check if this notification type is enabled
  const isEnabled = 
    (type === 'session-reminder' && prefs.sessionReminders) ||
    (type === 'deadline-alert' && prefs.deadlineAlerts) ||
    (type === 'study-plan-update' && prefs.studyPlanUpdates)

  if (!isEnabled) {
    return // User has disabled this notification type
  }

  const notificationId = uuidv4()
  const notification: Notification = {
    id: notificationId,
    userId,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: Date.now(),
  }

  // Send in-app notification (always if enabled)
  if (prefs.inApp) {
    await adminDb.doc(`users/${userId}/notifications/${notificationId}`).set(notification)
  }

  // Send browser push notification
  if (prefs.browserPush) {
    try {
      const subscriptionsSnap = await adminDb
        .collection(`users/${userId}/push-subscriptions`)
        .get()

      const pushPromises = subscriptionsSnap.docs.map(async (doc) => {
        const subscription = doc.data().subscription
        try {
          await webpush.sendNotification(subscription, JSON.stringify({
            title,
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            data: { url: link || '/' },
          }))
        } catch (err: any) {
          // If subscription is invalid, remove it
          if (err.statusCode === 410 || err.statusCode === 404) {
            await doc.ref.delete()
          }
          throw err
        }
      })

      await Promise.allSettled(pushPromises)
    } catch (err) {
      console.error('Error sending push notification:', err)
      // Continue even if push fails
    }
  }

  // Send email notification (if configured)
  if (prefs.email) {
    // Email sending would be implemented here
    // For now, we'll skip it as it requires additional setup (SendGrid, Resend, etc.)
    console.log('Email notification would be sent:', { userId, title, message })
  }
}

export async function scheduleSessionReminder(
  sessionId: string,
  userId: string,
  sessionTitle: string,
  startsAt: Date
) {
  const userDoc = await adminDb.doc(`users/${userId}`).get()
  const prefs = userDoc.data()?.notificationPreferences as NotificationPreferences | undefined

  if (!prefs || !prefs.sessionReminders) {
    return
  }

  const reminderTime = new Date(startsAt.getTime() - prefs.reminderTiming * 60 * 1000)
  const now = new Date()

  if (reminderTime <= now) {
    // Send immediately if reminder time has passed
    await sendNotification({
      userId,
      type: 'session-reminder',
      title: 'Study Session Starting Soon',
      message: `Your study session "${sessionTitle}" starts in ${prefs.reminderTiming} minutes.`,
      link: `/session/${sessionId}`,
    })
  } else {
    // Schedule for later (in a real app, you'd use a job queue like Bull, Agenda, etc.)
    // For now, we'll just send it immediately
    // TODO: Implement proper scheduling
    setTimeout(async () => {
      await sendNotification({
        userId,
        type: 'session-reminder',
        title: 'Study Session Starting Soon',
        message: `Your study session "${sessionTitle}" starts in ${prefs.reminderTiming} minutes.`,
        link: `/session/${sessionId}`,
      })
    }, reminderTime.getTime() - now.getTime())
  }
}

export async function sendDeadlineAlert(
  userId: string,
  taskTitle: string,
  courseName: string,
  dueAt: Date
) {
  await sendNotification({
    userId,
    type: 'deadline-alert',
    title: `Upcoming Deadline: ${taskTitle}`,
    message: `${taskTitle} for ${courseName} is due ${dueAt.toLocaleDateString()}.`,
  })
}

export async function sendStudyPlanUpdate(userId: string) {
  await sendNotification({
    userId,
    type: 'study-plan-update',
    title: 'Study Plan Updated',
    message: 'Your study plan has been updated with new sessions.',
    link: '/plan',
  })
}


'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore'
import type { Notification } from '@/lib/schema'

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return

      const notificationsRef = collection(db, 'users', user.uid, 'notifications')
      const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(20))

      const unsubscribeSnapshot = onSnapshot(
        q,
        (snap) => {
          const notifs = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Notification))
          setNotifications(notifs)
          setUnreadCount(notifs.filter(n => !n.read).length)
        },
        (err) => {
          console.error('Error fetching notifications:', err)
        }
      )

      return () => unsubscribeSnapshot()
    })

    return () => unsubscribe()
  }, [])

  const markAsRead = async (id: string) => {
    const user = auth.currentUser
    if (!user) return

    try {
      await updateDoc(doc(db, 'users', user.uid, 'notifications', id), {
        read: true,
      })
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    const user = auth.currentUser
    if (!user) return

    const unread = notifications.filter(n => !n.read)
    await Promise.all(
      unread.map(n => markAsRead(n.id))
    )
  }

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markAsRead(notif.id)
    }
    if (notif.link) {
      window.location.href = notif.link
    }
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Notifications"
      >
        <svg
          className="h-6 w-6 text-gray-950 dark:text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-950/10 bg-white shadow-lg z-50 dark:border-white/10 dark:bg-gray-950">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-950 dark:text-white">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                  No notifications
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {notifications.map(notif => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-900 ${
                        !notif.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            !notif.read
                              ? 'text-gray-950 dark:text-white'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {notif.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {notif.message}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                            {new Date(notif.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-600 mt-1 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}


'use client'

import { useEffect } from 'react'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    let unsubscribeAuth: (() => void) | null = null

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope)

        // Subscribe to push notifications when user is authenticated
        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (!user) return

          // Only subscribe if VAPID key is configured
          if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
            console.log('VAPID public key not configured, skipping push subscription')
            return
          }

          try {
            // Request notification permission
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
              console.log('Notification permission denied')
              return
            }

            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
              ),
            })

            // Send subscription to server
            const idToken = await user.getIdToken()
            await fetch('/api/notifications/subscribe', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ subscription }),
            })

            console.log('Push subscription registered')
          } catch (err) {
            console.error('Error subscribing to push notifications:', err)
          }
        })
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err)
      })

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
    }
  }, [])

  return null
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) {
    return new Uint8Array(0)
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}


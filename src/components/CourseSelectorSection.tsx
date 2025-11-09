'use client'

import { useState, useEffect } from 'react'
import CourseSelector from '@/components/CourseSelector'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

export default function CourseSelectorSection() {
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      const user = auth.currentUser
      if (!user) {
        setChecking(false)
        return
      }

      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/canvas/status', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        const data = await res.json()
        setConnected(data.connected || false)
      } catch (err) {
        setConnected(false)
      } finally {
        setChecking(false)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        checkStatus()
      } else {
        setConnected(false)
        setChecking(false)
      }
    })

    return () => unsubscribe()
  }, [])

  if (checking) return null
  if (!connected) return null

  return (
    <section className="space-y-2">
      <CourseSelector />
    </section>
  )
}


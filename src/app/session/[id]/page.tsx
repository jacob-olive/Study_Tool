'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import SessionPlayer from '@/components/SessionPlayer'

export default function SessionPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid)
        setLoading(false)
      } else {
        window.location.href = '/login'
      }
    })

    return () => unsubscribe()
  }, [])

  if (loading || !uid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return <SessionPlayer uid={uid} />
}

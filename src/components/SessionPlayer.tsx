'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase/client'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/button'
import { Navbar } from '@/components/navbar'

export default function SessionPlayer({ uid }: { uid: string }) {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const [secs, setSecs] = useState(50 * 60)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const ref = doc(db, 'users', uid, 'plans', 'active', 'sessions', sessionId)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          const data = snap.data()
          const startsAt = new Date(data.startsAt)
          const endsAt = new Date(data.endsAt)
          const now = new Date()
          const totalSeconds = Math.floor((endsAt.getTime() - startsAt.getTime()) / 1000)
          const elapsed = Math.floor((now.getTime() - startsAt.getTime()) / 1000)
          setSecs(Math.max(0, totalSeconds - elapsed))
        }
      } catch (err) {
        console.error('Error loading session:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uid, sessionId])

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const complete = async () => {
    setCompleting(true)
    try {
      const ref = doc(db, 'users', uid, 'plans', 'active', 'sessions', sessionId)
      await updateDoc(ref, { status: 'done' })
      await fetch('/api/plan/recompute', { method: 'POST' })
      router.push('/plan')
    } catch (err) {
      alert('Failed to complete session: ' + (err as Error).message)
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar>
          <div className="min-w-0">Session</div>
        </Navbar>
        <main className="px-4 sm:px-6">
          <div className="mx-auto max-w-6xl py-12">
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        </main>
      </>
    )
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <>
      <Navbar>
        <div className="min-w-0">Study Session</div>
      </Navbar>
      <main className="px-4 sm:px-6">
        <div className="mx-auto max-w-6xl py-12">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="text-6xl font-mono text-gray-950 dark:text-white">
              {mm}:{ss}
            </div>
            <Button onClick={complete} disabled={completing} className="px-6 py-3">
              {completing ? 'Completing...' : 'Mark complete'}
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}


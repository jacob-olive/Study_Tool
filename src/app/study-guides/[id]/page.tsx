'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ClientProtected } from '@/components/ClientProtected'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/button'
import { TextInput } from '@/components/input'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import StudyGuideCalendar from '@/components/StudyGuideCalendar'
import type { StudyGuide, StudySchedule } from '@/lib/schema'

function StudyGuideDetailContent() {
  const params = useParams()
  const router = useRouter()
  const guideId = params.id as string

  const [guide, setGuide] = useState<StudyGuide | null>(null)
  const [schedule, setSchedule] = useState<StudySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingSchedule, setCreatingSchedule] = useState(false)
  const [targetDate, setTargetDate] = useState('')
  const [showScheduleForm, setShowScheduleForm] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }

      // Listen to study guide
      const guideRef = doc(db, 'users', user.uid, 'study-guides', guideId)
      const unsubscribeGuide = onSnapshot(guideRef, (snap) => {
        if (snap.exists()) {
          setGuide({ id: snap.id, ...snap.data() } as StudyGuide)
        } else {
          setGuide(null)
        }
        setLoading(false)
      })

      // Listen to schedule
      const scheduleRef = doc(db, 'users', user.uid, 'study-guides', guideId, 'schedule', 'main')
      const unsubscribeSchedule = onSnapshot(scheduleRef, (snap) => {
        if (snap.exists()) {
          setSchedule({ id: snap.id, ...snap.data() } as StudySchedule)
          setShowScheduleForm(false)
        } else {
          setSchedule(null)
        }
      })

      return () => {
        unsubscribeGuide()
        unsubscribeSchedule()
      }
    })

    return () => unsubscribe()
  }, [guideId, router])

  const handleCreateSchedule = async () => {
    if (!targetDate) {
      alert('Please enter a target date')
      return
    }

    const user = auth.currentUser
    if (!user) return

    setCreatingSchedule(true)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch(`/api/study-guides/${guideId}/schedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetDate }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(`Failed to create schedule: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to create schedule'}`)
    } finally {
      setCreatingSchedule(false)
    }
  }

  const handleItemComplete = async (itemId: string, completed: boolean) => {
    const user = auth.currentUser
    if (!user) return

    try {
      const idToken = await user.getIdToken()
      const res = await fetch(`/api/study-guides/${guideId}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update item')
      }
    } catch (err: any) {
      console.error('Error updating item:', err)
      throw err
    }
  }

  const formatStudyGuide = (text: string) => {
    if (!text) return null

    return text.split('\n').map((line, index) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={index} className="mt-6 mb-2 text-lg font-semibold text-gray-950 dark:text-white">
            {line.replace('### ', '')}
          </h3>
        )
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={index} className="mt-6 mb-3 text-xl font-semibold text-gray-950 dark:text-white">
            {line.replace('## ', '')}
          </h2>
        )
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={index} className="mt-6 mb-4 text-2xl font-bold text-gray-950 dark:text-white">
            {line.replace('# ', '')}
          </h1>
        )
      }

      const boldRegex = /\*\*(.+?)\*\*/g
      let formattedLine = line

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2)
        if (boldRegex.test(content)) {
          const parts = content.split(boldRegex)
          return (
            <li key={index} className="ml-4 mb-1 text-gray-700 dark:text-gray-300">
              {parts.map((part, i) =>
                i % 2 === 1 ? (
                  <strong key={i} className="font-semibold text-gray-950 dark:text-white">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </li>
          )
        }
        return (
          <li key={index} className="ml-4 mb-1 text-gray-700 dark:text-gray-300">
            {content}
          </li>
        )
      }

      if (boldRegex.test(formattedLine)) {
        const parts = formattedLine.split(boldRegex)
        return (
          <p key={index} className="mb-2 text-gray-700 dark:text-gray-300">
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="font-semibold text-gray-950 dark:text-white">
                  {part}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        )
      }

      if (line.trim() === '') {
        return <div key={index} className="h-2" />
      }

      return (
        <p key={index} className="mb-2 text-gray-700 dark:text-gray-300">
          {line}
        </p>
      )
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!guide) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-red-600 dark:text-red-400">Study guide not found</div>
      </div>
    )
  }

  return (
    <div className="pb-30">
      <Navbar>
        <div className="min-w-0">{guide.name}</div>
      </Navbar>
      <main className="px-4 sm:px-6">
        <div className="mx-auto max-w-6xl py-12 space-y-8">
          {/* Study Guide Content */}
          {guide.status === 'ready' && guide.aiContent && (
            <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
              <h2 className="text-xl font-semibold text-gray-950 dark:text-white mb-4">
                Study Guide Content
              </h2>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {formatStudyGuide(guide.aiContent)}
              </div>
            </div>
          )}

          {/* Schedule Section */}
          <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
            {schedule ? (
              <StudyGuideCalendar schedule={schedule} onItemComplete={handleItemComplete} />
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-gray-950 dark:text-white mb-4">
                  Study Schedule
                </h2>
                {showScheduleForm ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
                        Target Date (Test/Assignment Due Date) *
                      </label>
                      <TextInput
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        required
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        The study schedule will be distributed across days leading up to this date.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreateSchedule}
                        disabled={creatingSchedule || !targetDate}
                      >
                        {creatingSchedule ? 'Creating...' : 'Create Schedule'}
                      </Button>
                      <Button
                        onClick={() => setShowScheduleForm(false)}
                        type="button"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Create a study schedule to break down this guide into daily study items.
                    </p>
                    <Button onClick={() => setShowScheduleForm(true)}>
                      Create Study Schedule
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function StudyGuideDetailPage() {
  return (
    <ClientProtected>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      }>
        <StudyGuideDetailContent />
      </Suspense>
    </ClientProtected>
  )
}


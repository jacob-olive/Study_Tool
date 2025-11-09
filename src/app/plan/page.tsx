'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import StudyPlanBoard from '@/components/StudyPlanBoard'
import AIStudyPlan from '@/components/AIStudyPlan'
import UpcomingAssignments from '@/components/UpcomingAssignments'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/button'

export default function PlanPage() {
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiPlan, setAiPlan] = useState<string | undefined>()
  const [aiGeneratedAt, setAiGeneratedAt] = useState<number | undefined>()

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

  // Listen to AI study plan updates
  useEffect(() => {
    if (!uid) return

    const planRef = doc(db, 'users', uid, 'plans', 'active')
    return onSnapshot(planRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setAiPlan(data.aiStudyPlan)
        setAiGeneratedAt(data.aiGeneratedAt)
      }
    })
  }, [uid])

  if (loading || !uid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="pb-30">
      <Navbar>
        <div className="min-w-0">Study Plan</div>
      </Navbar>
      <main className="px-4 sm:px-6">
        <div className="mx-auto max-w-6xl py-12 space-y-8">
          {/* AI Study Plan Section */}
          <AIStudyPlan 
            initialPlan={aiPlan} 
            initialGeneratedAt={aiGeneratedAt}
          />

          {/* Upcoming Assignments Section */}
          <UpcomingAssignments uid={uid} />

          {/* Session Schedule Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-semibold text-gray-950 dark:text-white">
                Study Sessions Schedule
              </h1>
              <form action="/api/plan/recompute" method="post">
                <Button type="submit">Recompute Schedule</Button>
              </form>
            </div>
            <StudyPlanBoard uid={uid} />
          </div>
        </div>
      </main>
    </div>
  )
}

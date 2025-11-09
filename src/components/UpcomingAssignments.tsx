'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase/client'
import { collection, query, onSnapshot } from 'firebase/firestore'
import { format } from 'date-fns'

type Task = {
  id: string
  title: string
  courseName?: string
  type?: string
  dueAt: string | null
  estimatedMinutes?: number
  url?: string | null
}

export default function UpcomingAssignments({ uid }: { uid: string }) {
  const [assignments, setAssignments] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return

    const planRef = collection(db, 'users', uid, 'plans', 'active', 'tasks')
    
    // Get all tasks and filter/sort client-side (avoids Firestore index requirements)
    const q = query(planRef)

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
        
        // Filter tasks with due dates and sort by due date
        const tasksWithDueDates = allTasks
          .filter(t => t.dueAt !== null && t.dueAt !== undefined)
          .sort((a, b) => {
            if (!a.dueAt || !b.dueAt) return 0
            return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
          })
          .slice(0, 5)
        
        setAssignments(tasksWithDueDates)
        setLoading(false)
        setError(null)
        
        // Debug: log total tasks found
        console.log(`UpcomingAssignments: Found ${snap.size} total tasks, ${tasksWithDueDates.length} with due dates`)
        if (snap.size > 0 && tasksWithDueDates.length === 0) {
          console.warn('Tasks exist but none have due dates:', allTasks.map(t => ({ title: t.title, dueAt: t.dueAt })))
        }
      },
      (err) => {
        console.error('Error fetching assignments:', err)
        setError('Failed to load assignments')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [uid])

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'exam': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'quiz': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'assignment': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'discussion': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'module': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const formatDueDate = (dueAt: string | null) => {
    if (!dueAt) return 'No due date'
    const date = new Date(dueAt)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return `Overdue (${format(date, 'MMM d, yyyy')})`
    if (diffDays === 0) return 'Due today'
    if (diffDays === 1) return 'Due tomorrow'
    if (diffDays <= 7) return `Due in ${diffDays} days (${format(date, 'MMM d')})`
    return format(date, 'MMM d, yyyy')
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold text-gray-950 dark:text-white mb-4">
          Upcoming Assignments
        </h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading assignments...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold text-gray-950 dark:text-white mb-4">
          Upcoming Assignments
        </h2>
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-semibold text-gray-950 dark:text-white mb-4">
          Upcoming Assignments
        </h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          No assignments with due dates found. Make sure you've synced Canvas and your courses have assignments with due dates.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
      <h2 className="text-xl font-semibold text-gray-950 dark:text-white mb-4">
        Next 5 Upcoming Assignments
      </h2>
      <div className="space-y-3">
        {assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="rounded-lg border border-gray-950/10 p-4 hover:bg-gray-950/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {assignment.type && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(assignment.type)}`}>
                      {assignment.type}
                    </span>
                  )}
                  {assignment.courseName && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {assignment.courseName}
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-gray-950 dark:text-white mb-1">
                  {assignment.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>{formatDueDate(assignment.dueAt)}</span>
                  {assignment.estimatedMinutes && (
                    <span>Est. {assignment.estimatedMinutes} min</span>
                  )}
                </div>
              </div>
              {assignment.url && (
                <a
                  href={assignment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Open →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {assignments.length === 5 && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing next 5 assignments. Sync Canvas to see all assignments.
        </div>
      )}
    </div>
  )
}


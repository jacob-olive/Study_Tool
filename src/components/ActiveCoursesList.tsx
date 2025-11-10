'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

type Course = {
  id: string
  name: string
  courseCode: string
  enrollmentState: 'active' | 'completed'
}

export default function ActiveCoursesList() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCourses = async () => {
      const user = auth.currentUser
      if (!user) return

      setLoading(true)
      setError(null)

      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/canvas/courses', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to fetch courses')
        }

        const data = await res.json()
        const activeCourses = (data.courses || []).filter(
          (c: Course) => c.enrollmentState === 'active'
        )
        setCourses(activeCourses)
      } catch (err: any) {
        setError(err.message || 'Failed to load courses')
        console.error('Error loading courses:', err)
      } finally {
        setLoading(false)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadCourses()
      } else {
        setCourses([])
      }
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading courses...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
        <h2 className="text-lg font-medium text-gray-950 dark:text-white mb-2">
          Active Courses
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No active courses found. Make sure Canvas is connected in Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
      <h2 className="text-lg font-medium text-gray-950 dark:text-white mb-4">
        Active Courses
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Select a course to create a study guide or manage your study plan.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map(course => (
          <Link
            key={course.id}
            href={`/study-guides?courseId=${course.id}`}
            className="rounded-lg border-2 border-gray-200 p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-white/10 dark:hover:border-blue-400 dark:hover:bg-blue-900/20 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-950 dark:text-white truncate">
                  {course.name}
                </h3>
                {course.courseCode && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {course.courseCode}
                  </p>
                )}
              </div>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                Active
              </span>
            </div>
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
              Create Study Guide →
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}


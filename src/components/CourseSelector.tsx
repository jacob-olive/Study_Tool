'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'

type Course = {
  id: string
  name: string
  courseCode: string
  enrollmentState: 'active' | 'completed'
}

export default function CourseSelector() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCoursesAndPreferences = async () => {
      const user = auth.currentUser
      if (!user) return

      setLoading(true)
      setError(null)

      try {
        // Fetch courses from API
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
        setCourses(data.courses || [])

        // Load saved preferences
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const prefs = userDoc.data()?.preferences
        if (prefs?.selectedCourseIds && Array.isArray(prefs.selectedCourseIds)) {
          setSelectedCourseIds(new Set(prefs.selectedCourseIds))
        } else {
          // Default: select all active courses
          const activeIds = data.courses
            .filter((c: Course) => c.enrollmentState === 'active')
            .map((c: Course) => c.id)
          setSelectedCourseIds(new Set(activeIds))
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load courses')
        console.error('Error loading courses:', err)
      } finally {
        setLoading(false)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadCoursesAndPreferences()
      }
    })

    return () => unsubscribe()
  }, [])

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) {
        next.delete(courseId)
      } else {
        next.add(courseId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedCourseIds(new Set(courses.map(c => c.id)))
  }

  const handleDeselectAll = () => {
    setSelectedCourseIds(new Set())
  }

  const handleSave = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('Please sign in to save preferences')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const userRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userRef)
      const currentData = userDoc.data() || {}

      await setDoc(userRef, {
        ...currentData,
        preferences: {
          ...currentData.preferences,
          selectedCourseIds: Array.from(selectedCourseIds),
        },
      }, { merge: true })

      alert('Course preferences saved successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences')
      console.error('Error saving preferences:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading courses...</p>
      </div>
    )
  }

  if (error && courses.length === 0) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    )
  }

  const activeCourses = courses.filter(c => c.enrollmentState === 'active')
  const completedCourses = courses.filter(c => c.enrollmentState === 'completed')

  return (
    <div className="rounded-lg border border-gray-950/10 p-4 space-y-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-950 dark:text-white">Manage Courses</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Select which courses to sync. {selectedCourseIds.size} of {courses.length} selected.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Select All
          </button>
          <span className="text-gray-400">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Deselect All
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {activeCourses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-950 dark:text-white mb-2">Active Courses</h3>
            <div className="space-y-2">
              {activeCourses.map(course => (
                <label
                  key={course.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.has(course.id)}
                    onChange={() => handleToggleCourse(course.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-950 dark:text-white">
                      {course.name}
                    </div>
                    {course.courseCode && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {course.courseCode}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {completedCourses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-950 dark:text-white mb-2">Past Courses</h3>
            <div className="space-y-2">
              {completedCourses.map(course => (
                <label
                  key={course.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.has(course.id)}
                    onChange={() => handleToggleCourse(course.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-950 dark:text-white">
                      {course.name}
                    </div>
                    {course.courseCode && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {course.courseCode}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                    Completed
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  )
}


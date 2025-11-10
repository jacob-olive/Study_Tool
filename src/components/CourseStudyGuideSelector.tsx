'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

type Course = {
  id: string
  name: string
  courseCode: string
  enrollmentState: 'active' | 'completed'
}

type CourseStudyGuideSelectorProps = {
  onCourseSelected: (courseId: string) => void
}

export default function CourseStudyGuideSelector({ onCourseSelected }: CourseStudyGuideSelectorProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
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
        setCourses(data.courses || [])
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
      }
    })

    return () => unsubscribe()
  }, [])

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId)
  }

  const handleCreateStudyGuide = () => {
    if (selectedCourseId) {
      onCourseSelected(selectedCourseId)
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
    <div className="rounded-lg border border-gray-950/10 p-6 space-y-4 dark:border-white/10">
      <div>
        <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Select a Course</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Choose a course to create a study guide for. The guide will focus on recent and upcoming assignments.
        </p>
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
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedCourseId === course.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="course-selection"
                    value={course.id}
                    checked={selectedCourseId === course.id}
                    onChange={() => handleCourseSelect(course.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedCourseId === course.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="course-selection"
                    value={course.id}
                    checked={selectedCourseId === course.id}
                    onChange={() => handleCourseSelect(course.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
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

        {courses.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No courses found. Make sure Canvas is connected.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-white/10">
        <Button 
          onClick={handleCreateStudyGuide} 
          disabled={!selectedCourseId}
        >
          Create Study Guide
        </Button>
      </div>
    </div>
  )
}


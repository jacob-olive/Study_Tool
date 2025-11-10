'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClientProtected } from '@/components/ClientProtected'
import { Navbar } from '@/components/navbar'
import CourseStudyGuideSelector from '@/components/CourseStudyGuideSelector'
import CourseStudyGuideGenerator from '@/components/CourseStudyGuideGenerator'
import StudyGuidesList from '@/components/StudyGuidesList'

function StudyGuidesContent() {
  const searchParams = useSearchParams()
  const courseIdFromUrl = searchParams.get('courseId')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(courseIdFromUrl)

  useEffect(() => {
    // Update selected course when URL changes
    if (courseIdFromUrl) {
      setSelectedCourseId(courseIdFromUrl)
    }
  }, [courseIdFromUrl])

  const handleCourseSelected = (courseId: string) => {
    setSelectedCourseId(courseId)
    // Update URL without page reload
    window.history.pushState({}, '', `/study-guides?courseId=${courseId}`)
  }

  const handleBack = () => {
    setSelectedCourseId(null)
    // Clear URL parameter
    window.history.pushState({}, '', '/study-guides')
  }

  return (
    <>
      {!selectedCourseId ? (
        <CourseStudyGuideSelector onCourseSelected={handleCourseSelected} />
      ) : (
        <CourseStudyGuideGenerator courseId={selectedCourseId} onBack={handleBack} />
      )}
      <StudyGuidesList />
    </>
  )
}

export default function StudyGuidesPage() {
  return (
    <ClientProtected>
      <div className="pb-30">
        <Navbar>
          <div className="min-w-0">Study Guides</div>
        </Navbar>
        <main className="px-4 sm:px-6">
          <div className="mx-auto max-w-6xl py-12">
            <h1 className="text-xl font-semibold text-gray-950 dark:text-white mb-6">
              Study Guides
            </h1>
            <div className="space-y-8">
              <Suspense fallback={<div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>}>
                <StudyGuidesContent />
              </Suspense>
            </div>
          </div>
        </main>
      </div>
    </ClientProtected>
  )
}

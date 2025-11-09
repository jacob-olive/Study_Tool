import Protected from '@/components/Protected'
import { Navbar } from '@/components/navbar'
import StudyGuideUploader from '@/components/StudyGuideUploader'
import StudyGuidesList from '@/components/StudyGuidesList'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Study Guides - StudyFlow',
}

export default async function StudyGuidesPage() {
  return (
    <Protected>
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
              <StudyGuideUploader />
              <StudyGuidesList />
            </div>
          </div>
        </main>
      </div>
    </Protected>
  )
}


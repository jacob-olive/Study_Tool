import Protected from '@/components/Protected'
import CanvasConnectCard from '@/components/CanvasConnectCard'
import CourseSelectorSection from '@/components/CourseSelectorSection'
import NotificationPreferences from '@/components/NotificationPreferences'
import { Navbar } from '@/components/navbar'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings - StudyFlow',
}

export default async function Settings() {
  return (
    <Protected>
      <div className="pb-30">
        <Navbar>
          <div className="min-w-0">Settings</div>
        </Navbar>
        <main className="px-4 sm:px-6">
          <div className="mx-auto max-w-6xl py-12">
            <h1 className="text-xl font-semibold text-gray-950 dark:text-white">Settings</h1>
            <div className="mt-6 space-y-6">
              <CanvasConnectCard />
              <CourseSelectorSection />
              <NotificationPreferences />
              <section className="space-y-2">
                <h2 className="font-medium text-gray-950 dark:text-white">Study Preferences</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Coming soon: weekly schedule, session length, difficulty, reminders.
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </Protected>
  )
}


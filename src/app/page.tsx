import Protected from '@/components/Protected'
import Link from 'next/link'
import { Navbar } from '@/components/navbar'
import ActiveCoursesList from '@/components/ActiveCoursesList'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'StudyFlow - Dashboard',
}

export default async function Dashboard() {
  return (
    <Protected>
      <div className="pb-30">
        <Navbar>
          <div className="min-w-0">StudyFlow</div>
        </Navbar>
        <main className="px-4 sm:px-6">
          <div className="mx-auto max-w-6xl py-12">
            <h1 className="text-3xl font-semibold text-gray-950 dark:text-white">Dashboard</h1>
            <p className="mt-2 text-base/7 text-gray-600 dark:text-gray-400">
              Manage your study plan and Canvas integration
            </p>
            
            <div className="mt-8">
              <ActiveCoursesList />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Link
                href="/plan"
                className="rounded-lg border border-gray-950/10 p-6 hover:bg-gray-950/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Study Plan</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  View and manage your scheduled study sessions
                </p>
              </Link>
              <Link
                href="/settings"
                className="rounded-lg border border-gray-950/10 p-6 hover:bg-gray-950/5 dark:border-white/10 dark:hover:bg-white/5"
              >
                <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Settings</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Connect Canvas and customize your preferences
                </p>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </Protected>
  )
}


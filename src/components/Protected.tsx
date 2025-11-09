import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { ClientProtected } from './ClientProtected'

export default async function Protected({ children }: { children: ReactNode }) {
  // Check if Admin SDK is configured
  const hasAdminCreds = process.env.FIREBASE_CLIENT_EMAIL && 
                        process.env.FIREBASE_CLIENT_EMAIL !== 'your_service_account_email@study-tool-a4fbb.iam.gserviceaccount.com' &&
                        process.env.FIREBASE_PRIVATE_KEY && 
                        !process.env.FIREBASE_PRIVATE_KEY.includes('...')
  
  // If Admin SDK not configured, use client-side protection
  if (!hasAdminCreds) {
    return <ClientProtected>{children}</ClientProtected>
  }
  
  // Otherwise use server-side session check
  const user = await getServerUser()
  if (!user) redirect('/login')
  return <>{children}</>
}


'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'

export function ClientProtected({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let mounted = true
    
    console.log('ClientProtected: Setting up auth listener')
    
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        console.log('ClientProtected: Auth state changed', user ? 'authenticated' : 'not authenticated')
        if (!mounted) return
        clearTimeout(timeoutId)
        if (user) {
          setAuthenticated(true)
          setLoading(false)
        } else {
          setLoading(false)
          router.push('/login')
        }
      },
      (error) => {
        console.error('ClientProtected: Auth state error:', error)
        if (!mounted) return
        clearTimeout(timeoutId)
        setLoading(false)
        router.push('/login')
      }
    )

    // Timeout after 3 seconds if auth state doesn't resolve
    timeoutId = setTimeout(() => {
      if (!mounted) return
      console.warn('ClientProtected: Auth state check timed out, redirecting to login')
      setLoading(false)
      router.push('/login')
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return <>{children}</>
}


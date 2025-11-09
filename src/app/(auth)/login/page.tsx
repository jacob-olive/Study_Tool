'use client'

import { auth } from '@/lib/firebase/client'
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { useState } from 'react'
import { Button } from '@/components/button'
import { TextInput } from '@/components/input'

export const dynamic = 'force-dynamic'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const signInGoogle = async () => {
    try {
      setLoading(true)
      setError(null)
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      const idToken = await cred.user.getIdToken()
      const res = await fetch('/api/auth/session', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ idToken }) 
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // If Admin SDK not configured, still allow login but show warning
        if (data.error && data.error.includes('Admin SDK not configured')) {
          console.warn('Admin SDK not configured - using client-side auth only')
          // Still redirect - client-side auth will work
          window.location.href = '/'
          return
        }
        throw new Error(data.error || `Session creation failed: ${res.status}`)
      }
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      setLoading(false)
    }
  }

  const signInEmail = async () => {
    try {
      setLoading(true)
      setError(null)
      let cred
      if (isSignUp) {
        cred = await createUserWithEmailAndPassword(auth, email, password)
      } else {
        cred = await signInWithEmailAndPassword(auth, email, password)
      }
      const idToken = await cred.user.getIdToken()
      const res = await fetch('/api/auth/session', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ idToken }) 
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // If Admin SDK not configured, still allow login but show warning
        if (data.error && data.error.includes('Admin SDK not configured')) {
          console.warn('Admin SDK not configured - using client-side auth only')
          // Still redirect - client-side auth will work
          window.location.href = '/'
          return
        }
        throw new Error(data.error || `Session creation failed: ${res.status}`)
      }
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`)
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="sr-only">Login</h1>
      <div className="space-y-4">
        <Button
          onClick={signInGoogle}
          disabled={loading}
          className="w-full"
        >
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-950/10 dark:border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm/6">
            <span className="bg-white px-2 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
              Or
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            signInEmail()
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block w-full text-sm/7 font-medium text-gray-950 dark:text-white"
            >
              Email
            </label>
            <TextInput
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block w-full text-sm/7 font-medium text-gray-950 dark:text-white"
            >
              Password
            </label>
            <TextInput
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
              disabled={loading}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {isSignUp ? 'Sign up' : 'Sign in'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-sm text-gray-500 underline dark:text-gray-400"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </>
  )
}


import { cookies } from 'next/headers'
import { adminAuth } from './firebase/admin'
import { NextRequest } from 'next/server'

export async function getServerUser(req?: NextRequest) {
  // First try to get from session cookie
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true)
      return decoded
    } catch {
      // Session cookie invalid, continue to check ID token
    }
  }

  // If no session cookie, try to get ID token from Authorization header
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.substring(7)
      try {
        const decoded = await adminAuth.verifyIdToken(idToken)
        return decoded
      } catch {
        // ID token invalid
      }
    }
  }

  return null
}


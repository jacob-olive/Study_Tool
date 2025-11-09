import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json()
    if (!idToken) return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    
    // Check if Admin SDK is configured
    const hasAdminCreds = process.env.FIREBASE_CLIENT_EMAIL && 
                          process.env.FIREBASE_CLIENT_EMAIL !== 'your_service_account_email@study-tool-a4fbb.iam.gserviceaccount.com' &&
                          process.env.FIREBASE_PRIVATE_KEY && 
                          !process.env.FIREBASE_PRIVATE_KEY.includes('...')
    
    if (!hasAdminCreds) {
      return NextResponse.json({ 
        error: 'Firebase Admin SDK not configured. Please add FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY to .env.local' 
      }, { status: 500 })
    }
    
    const expiresIn = 1000 * 60 * 60 * 24 * 5 // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn })
    const cookieStore = await cookies()
    cookieStore.set('session', sessionCookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Session creation error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create session' 
    }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  return NextResponse.json({ ok: true })
}


import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { decrypt } from '@/lib/canvas'

async function canvasFetch<T>(baseUrl: string, path: string, token: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  })
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText)
    throw new Error(`Canvas API error ${res.status}: ${errorText}`)
  }
  return res.json() as Promise<T>
}

export async function GET(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const privSnap = await adminDb.doc(`users/${user.uid}/private/canvas`).get()
  if (!privSnap.exists) {
    return NextResponse.json({ error: 'Canvas not connected' }, { status: 400 })
  }

  const { token: enc, baseUrl } = privSnap.data() as any
  const { access_token } = JSON.parse(decrypt(enc)) as { access_token: string }

  try {
    // Fetch both active and completed courses
    const [activeCourses, completedCourses] = await Promise.all([
      canvasFetch<any[]>(baseUrl, '/api/v1/courses?enrollment_state=active', access_token),
      canvasFetch<any[]>(baseUrl, '/api/v1/courses?enrollment_state=completed', access_token),
    ])

    const courses = [
      ...activeCourses.map(c => ({ ...c, enrollmentState: 'active' as const })),
      ...completedCourses.map(c => ({ ...c, enrollmentState: 'completed' as const })),
    ]

    return NextResponse.json({
      ok: true,
      courses: courses.map(c => ({
        id: c.id.toString(),
        name: c.name,
        courseCode: c.course_code || '',
        enrollmentState: c.enrollmentState,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching Canvas courses:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch courses' },
      { status: 500 }
    )
  }
}


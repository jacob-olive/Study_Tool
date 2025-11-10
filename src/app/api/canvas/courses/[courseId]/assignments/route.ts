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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const courseId = params.courseId

  const privSnap = await adminDb.doc(`users/${user.uid}/private/canvas`).get()
  if (!privSnap.exists) {
    return NextResponse.json({ error: 'Canvas not connected' }, { status: 400 })
  }

  const { token: enc, baseUrl } = privSnap.data() as any
  const { access_token } = JSON.parse(decrypt(enc)) as { access_token: string }

  try {
    // Fetch assignments for the specific course
    const assignments = await canvasFetch<any[]>(
      baseUrl,
      `/api/v1/courses/${courseId}/assignments`,
      access_token
    )

    const now = new Date()
    const assignmentsWithDates = assignments.map(a => ({
      id: a.id.toString(),
      name: a.name,
      dueAt: a.due_at ? new Date(a.due_at).toISOString() : null,
      pointsPossible: a.points_possible || 0,
      submissionTypes: a.submission_types || [],
      htmlUrl: a.html_url,
      description: a.description || '',
      courseId: courseId,
    }))

    // Categorize assignments
    const recentAssignments = assignmentsWithDates.filter(a => {
      if (!a.dueAt) return false
      const dueDate = new Date(a.dueAt)
      const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysDiff >= 0 && daysDiff <= 14 // Past 2 weeks
    })

    const upcomingAssignments = assignmentsWithDates.filter(a => {
      if (!a.dueAt) return false
      const dueDate = new Date(a.dueAt)
      return dueDate > now
    })

    const pastAssignments = assignmentsWithDates.filter(a => {
      if (!a.dueAt) return true // No due date counts as past
      const dueDate = new Date(a.dueAt)
      const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysDiff > 14 // More than 2 weeks ago
    })

    return NextResponse.json({
      ok: true,
      assignments: {
        recent: recentAssignments,
        upcoming: upcomingAssignments,
        past: pastAssignments,
        all: assignmentsWithDates,
      },
    })
  } catch (error: any) {
    console.error('Error fetching Canvas assignments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assignments' },
      { status: 500 }
    )
  }
}


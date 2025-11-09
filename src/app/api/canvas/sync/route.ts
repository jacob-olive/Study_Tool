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

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const privSnap = await adminDb.doc(`users/${user.uid}/private/canvas`).get()
  if (!privSnap.exists) return NextResponse.json({ error: 'Canvas not connected' }, { status: 400 })

  const { token: enc, baseUrl } = privSnap.data() as any
  const { access_token } = JSON.parse(decrypt(enc)) as { access_token: string }

  // Parse request body for optional courseIds filter
  let courseIds: string[] | undefined
  try {
    const body = await req.json().catch(() => ({}))
    courseIds = body.courseIds
  } catch {
    // No body or invalid JSON, use defaults
  }

  // 1. Fetch courses
  let courses: any[] = []
  if (courseIds && courseIds.length > 0) {
    // Fetch specific courses by ID
    const coursePromises = courseIds.map(id =>
      canvasFetch<any>(baseUrl, `/api/v1/courses/${id}`, access_token).catch(() => null)
    )
    const fetchedCourses = await Promise.all(coursePromises)
    courses = fetchedCourses.filter(c => c !== null)
  } else {
    // Default: fetch active courses only
    courses = await canvasFetch<any[]>(baseUrl, '/api/v1/courses?enrollment_state=active', access_token)
  }

  // 2. For each course, fetch assignments, quizzes, and modules
  const tasks: any[] = []
  const errors: string[] = []
  
  for (const c of courses) {
    try {
      let assignments: any[] = []
      let quizzes: any[] = []
      let modules: any[] = []
      
      try {
        assignments = await canvasFetch<any[]>(baseUrl, `/api/v1/courses/${c.id}/assignments`, access_token)
      } catch (err: any) {
        errors.push(`Course ${c.name} (${c.id}): Failed to fetch assignments - ${err.message}`)
        console.error(`Failed to fetch assignments for course ${c.id}:`, err)
      }
      
      try {
        quizzes = await canvasFetch<any[]>(baseUrl, `/api/v1/courses/${c.id}/quizzes`, access_token)
      } catch (err: any) {
        errors.push(`Course ${c.name} (${c.id}): Failed to fetch quizzes - ${err.message}`)
        console.error(`Failed to fetch quizzes for course ${c.id}:`, err)
      }
      
      try {
        modules = await canvasFetch<any[]>(baseUrl, `/api/v1/courses/${c.id}/modules`, access_token)
      } catch (err: any) {
        errors.push(`Course ${c.name} (${c.id}): Failed to fetch modules - ${err.message}`)
        console.error(`Failed to fetch modules for course ${c.id}:`, err)
      }

      // Process assignments (includes exams, assignments, discussions, etc.)
      for (const a of assignments) {
        // Determine assignment type from submission types or name
        let assignmentType = 'assignment'
        const submissionTypes = a.submission_types || []
        const nameUpper = a.name.toUpperCase()
        
        if (submissionTypes.includes('online_quiz') || nameUpper.includes('QUIZ')) {
          assignmentType = 'quiz'
        } else if (nameUpper.includes('EXAM') || nameUpper.includes('TEST') || nameUpper.includes('MIDTERM') || nameUpper.includes('FINAL')) {
          assignmentType = 'exam'
        } else if (submissionTypes.includes('discussion_topic')) {
          assignmentType = 'discussion'
        }

        tasks.push({
          source: 'canvas',
          courseId: c.id,
          courseName: c.name,
          type: assignmentType,
          title: a.name,
          dueAt: a.due_at ? new Date(a.due_at).toISOString() : null,
          estimatedMinutes: Math.min(240, Math.max(30, Math.round((a.points_possible ?? 10) * 10))),
          url: a.html_url,
          priority: a.due_at ? 'high' : 'normal',
          status: 'todo',
          submissionTypes: submissionTypes,
        })
      }

      // Process standalone quizzes (not linked to assignments)
      for (const q of quizzes) {
        // Check if this quiz is already imported as an assignment
        const isDuplicate = assignments.some(a => a.quiz_id === q.id)
        if (isDuplicate) continue

        tasks.push({
          source: 'canvas',
          courseId: c.id,
          courseName: c.name,
          type: 'quiz',
          title: q.title,
          dueAt: q.due_at ? new Date(q.due_at).toISOString() : null,
          estimatedMinutes: Math.max(30, Math.round((q.time_limit || 60))),
          url: q.html_url,
          priority: q.due_at ? 'high' : 'normal',
          status: 'todo',
        })
      }

      // Process modules
      for (const m of modules) {
        tasks.push({
          source: 'canvas',
          courseId: c.id,
          courseName: c.name,
          type: 'module',
          title: m.name,
          dueAt: null,
          estimatedMinutes: 60,
          url: null,
          priority: 'normal',
          status: 'todo',
        })
      }
    } catch (err) {
      console.error(`Error fetching data for course ${c.id}:`, err)
    }
  }

  // 3. Save or upsert tasks under active plan
  const planRef = adminDb.collection(`users/${user.uid}/plans`).doc('active')
  await planRef.set({ title: 'Your Plan', updatedAt: Date.now() }, { merge: true })

  if (tasks.length === 0) {
    return NextResponse.json({ 
      ok: true, 
      counts: { tasks: 0, courses: courses.length },
      warning: 'No tasks found in Canvas. Make sure your courses have assignments, quizzes, or modules.',
      coursesChecked: courses.length,
      errors: errors.length > 0 ? errors : undefined,
      debug: {
        totalCourses: courses.length,
        courseNames: courses.map(c => c.name),
        errorsCount: errors.length
      }
    })
  }

  const batch = adminDb.bulkWriter()
  for (const t of tasks) {
    const id = `${t.type}-${t.courseId}-${Buffer.from(t.title).toString('base64').slice(0, 16)}`
    batch.set(planRef.collection('tasks').doc(id), { ...t, id }, { merge: true })
  }
  await batch.close()

  return NextResponse.json({ 
    ok: true, 
    counts: { 
      tasks: tasks.length,
      courses: courses.length
    },
    errors: errors.length > 0 ? errors : undefined,
    debug: {
      totalCourses: courses.length,
      courseNames: courses.map(c => c.name),
      errorsCount: errors.length
    }
  })
}


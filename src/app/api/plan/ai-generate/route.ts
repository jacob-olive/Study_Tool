import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import OpenAI from 'openai'
import { STUDY_PLAN_SYSTEM_MESSAGE, generateStudyPlanPrompt } from '@/lib/map'

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  try {
    // Fetch all tasks from Canvas
    const planRef = adminDb.doc(`users/${user.uid}/plans/active`)
    
    // Check if plan document exists
    const planSnap = await planRef.get()
    if (!planSnap.exists) {
      return NextResponse.json({ 
        error: 'No study plan found. Please sync Canvas first to create your plan.' 
      }, { status: 400 })
    }
    
    const tasksSnap = await planRef.collection('tasks').get()
    
    if (tasksSnap.empty) {
      // Provide helpful debugging info
      console.log(`No tasks found for user ${user.uid} in plan active`)
      return NextResponse.json({ 
        error: 'No tasks found. Please sync Canvas first. Make sure you have assignments, quizzes, or modules in your Canvas courses.',
        debug: {
          planExists: planSnap.exists,
          taskCount: tasksSnap.size
        }
      }, { status: 400 })
    }

    const tasks = tasksSnap.docs.map(d => d.data())

    // Group tasks by course
    const courseMap = new Map<string, any[]>()
    for (const task of tasks) {
      const courseName = task.courseName || 'Unknown Course'
      if (!courseMap.has(courseName)) {
        courseMap.set(courseName, [])
      }
      courseMap.get(courseName)!.push(task)
    }

    // Prepare data for AI
    const coursesSummary = Array.from(courseMap.entries()).map(([courseName, courseTasks]) => {
      const exams = courseTasks.filter(t => t.type === 'exam')
      const quizzes = courseTasks.filter(t => t.type === 'quiz')
      const assignments = courseTasks.filter(t => t.type === 'assignment')
      const discussions = courseTasks.filter(t => t.type === 'discussion')

      return {
        courseName,
        totalTasks: courseTasks.length,
        breakdown: {
          exams: exams.length,
          quizzes: quizzes.length,
          assignments: assignments.length,
          discussions: discussions.length,
        },
        upcomingDeadlines: courseTasks
          .filter(t => t.dueAt)
          .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
          .slice(0, 5)
          .map(t => ({
            title: t.title,
            type: t.type,
            dueAt: t.dueAt,
            estimatedMinutes: t.estimatedMinutes,
          })),
      }
    })

    // Count urgent items (due within 7 days)
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const urgentTasks = tasks.filter(t => {
      if (!t.dueAt) return false
      const dueDate = new Date(t.dueAt)
      return dueDate >= now && dueDate <= sevenDaysFromNow
    })

    // Generate AI study plan
    const prompt = generateStudyPlanPrompt({
      courseMapSize: courseMap.size,
      tasksLength: tasks.length,
      urgentTasksLength: urgentTasks.length,
      coursesSummary,
    })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: STUDY_PLAN_SYSTEM_MESSAGE,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    const studyPlan = completion.choices[0].message.content

    // Save the AI-generated plan to Firestore
    await planRef.set(
      {
        aiStudyPlan: studyPlan,
        aiGeneratedAt: Date.now(),
        aiModel: 'gpt-4o',
        updatedAt: Date.now(),
      },
      { merge: true }
    )

    return NextResponse.json({
      ok: true,
      studyPlan,
      stats: {
        totalCourses: courseMap.size,
        totalTasks: tasks.length,
        urgentTasks: urgentTasks.length,
      },
    })
  } catch (error: any) {
    console.error('AI study plan generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate study plan' },
      { status: 500 }
    )
  }
}


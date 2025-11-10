import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { decrypt } from '@/lib/canvas'
import OpenAI from 'openai'

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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  try {
    const { guideId } = await req.json()

    if (!guideId) {
      return NextResponse.json({ error: 'Guide ID is required' }, { status: 400 })
    }

    const guideRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}`)
    const guideSnap = await guideRef.get()

    if (!guideSnap.exists) {
      return NextResponse.json({ error: 'Study guide not found' }, { status: 404 })
    }

    const guide = guideSnap.data()
    if (!guide?.openaiFileId) {
      return NextResponse.json({ error: 'PDF file not found' }, { status: 400 })
    }

    await guideRef.update({ status: 'processing' })

    // Fetch course assignments if courseId exists
    let assignmentContext = ''
    let courseName = ''
    if (guide.courseId) {
      try {
        const privSnap = await adminDb.doc(`users/${user.uid}/private/canvas`).get()
        if (privSnap.exists) {
          const { token: enc, baseUrl } = privSnap.data() as any
          const { access_token } = JSON.parse(decrypt(enc)) as { access_token: string }

          // Fetch course details
          const courseRes = await canvasFetch<any>(
            baseUrl,
            `/api/v1/courses/${guide.courseId}`,
            access_token
          )
          courseName = courseRes.name || ''

          // Fetch assignments
          const assignmentsRes = await canvasFetch<any[]>(
            baseUrl,
            `/api/v1/courses/${guide.courseId}/assignments`,
            access_token
          )

          const now = new Date()
          const focusAssignments = assignmentsRes
            .filter(a => {
              if (!a.due_at) return false
              const dueDate = new Date(a.due_at)
              const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              return daysDiff >= -14 && daysDiff <= 30
            })
            .map(a => ({
              name: a.name,
              dueAt: a.due_at ? new Date(a.due_at).toISOString() : null,
              pointsPossible: a.points_possible || 0,
            }))

          if (focusAssignments.length > 0) {
            assignmentContext = `\n\nIMPORTANT: Focus on these recent and upcoming assignments as priority areas:\n${focusAssignments
              .map((a, idx) => {
                const dueDate = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : 'No due date'
                return `${idx + 1}. ${a.name} (Due: ${dueDate}${a.pointsPossible > 0 ? `, ${a.pointsPossible} points` : ''})`
              })
              .join('\n')}\n\nPrioritize content in the PDF that relates to these assignments.`
          }
        }
      } catch (err) {
        console.error('Error fetching course assignments:', err)
        // Continue without assignment context if fetch fails
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const courseContext = courseName ? ` for ${courseName}` : ''
    const instructions = `You are an expert at creating comprehensive study guides from PDF documents${courseContext}. Extract key concepts, create summaries, generate practice questions, and organize information in a clear, structured format. Focus on making the content ADHD-friendly with visual organization and actionable insights.${assignmentContext}`

    // Regenerate study guide using the same process as upload
    const assistant = await openai.beta.assistants.create({
      name: 'Study Guide Generator',
      instructions,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
    })

    const prompt = `Please analyze this PDF and create a comprehensive study guide${courseContext}. Include:
1. Key concepts and definitions
2. Main topics and subtopics
3. Important formulas or equations (if applicable)
4. Practice questions or exercises
5. Summary points
6. Visual organization tips${assignmentContext}

Format the output in clear markdown with headers and bullet points.`

    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: prompt,
          attachments: [
            {
              file_id: guide.openaiFileId,
              tools: [{ type: 'file_search' }],
            },
          ],
        },
      ],
    })

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id,
    })

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id)
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id)
    }

    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(thread.id)
      const assistantMessage = messages.data.find(m => m.role === 'assistant')
      
      if (assistantMessage && assistantMessage.content[0].type === 'text') {
        const aiContent = assistantMessage.content[0].text.value
        
        await guideRef.update({
          aiContent,
          aiGeneratedAt: Date.now(),
          status: 'ready',
          updatedAt: Date.now(),
        })

        await openai.beta.assistants.del(assistant.id)

        return NextResponse.json({
          ok: true,
          message: 'Study guide regenerated successfully',
          aiContent,
        })
      } else {
        throw new Error('No content generated')
      }
    } else {
      throw new Error(`Run failed with status: ${runStatus.status}`)
    }
  } catch (error: any) {
    console.error('Study guide generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to regenerate study guide' },
      { status: 500 }
    )
  }
}


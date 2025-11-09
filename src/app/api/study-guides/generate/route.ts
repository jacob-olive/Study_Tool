import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import OpenAI from 'openai'

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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Regenerate study guide using the same process as upload
    const assistant = await openai.beta.assistants.create({
      name: 'Study Guide Generator',
      instructions: 'You are an expert at creating comprehensive study guides from PDF documents. Extract key concepts, create summaries, generate practice questions, and organize information in a clear, structured format. Focus on making the content ADHD-friendly with visual organization and actionable insights.',
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
    })

    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: `Please analyze this PDF and create a comprehensive study guide. Include:
1. Key concepts and definitions
2. Main topics and subtopics
3. Important formulas or equations (if applicable)
4. Practice questions or exercises
5. Summary points
6. Visual organization tips

Format the output in clear markdown with headers and bullet points.`,
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


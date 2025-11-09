import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb, adminStorage } from '@/lib/firebase/admin'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const associationType = formData.get('associationType') as 'course' | 'task' | 'general'
    const associationId = formData.get('associationId') as string | null
    const associationName = formData.get('associationName') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Study guide name is required' }, { status: 400 })
    }

    const guideId = uuidv4()
    const pdfPath = `users/${user.uid}/study-guides/${guideId}.pdf`

    // Upload to Firebase Storage
    let bucket
    try {
      bucket = adminStorage.bucket()
      // If no bucket is configured, try to get default bucket
      if (!bucket) {
        const defaultBucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        if (defaultBucketName) {
          bucket = adminStorage.bucket(defaultBucketName)
        } else {
          throw new Error('Firebase Storage bucket not configured')
        }
      }
    } catch (err: any) {
      console.error('Error accessing Firebase Storage:', err)
      return NextResponse.json(
        { error: 'Firebase Storage not configured. Please ensure Storage is enabled in your Firebase project.' },
        { status: 500 }
      )
    }
    
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const storageFile = bucket.file(pdfPath)
    
    await storageFile.save(fileBuffer, {
      metadata: {
        contentType: 'application/pdf',
      },
    })

    // Get signed URL for download
    const [pdfUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Far future date
    })

    // Upload to OpenAI Files API
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const openaiFile = await openai.files.create({
      file: fileBuffer,
      purpose: 'assistants',
    })

    // Create study guide document in Firestore
    const guideData = {
      id: guideId,
      userId: user.uid,
      name: name.trim(),
      description: description?.trim() || null,
      pdfPath,
      pdfUrl,
      openaiFileId: openaiFile.id,
      associationType,
      associationId: associationId || null,
      associationName: associationName || null,
      aiContent: '',
      aiGeneratedAt: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'uploading' as const,
    }

    const guideRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}`)
    await guideRef.set(guideData)

    // Trigger study guide generation asynchronously
    // In production, you might want to use a queue system
    generateStudyGuide(user.uid, guideId, openaiFile.id).catch(err => {
      console.error('Error generating study guide:', err)
      guideRef.update({ status: 'error' })
    })

    return NextResponse.json({
      ok: true,
      guideId,
      status: 'uploading',
      message: 'PDF uploaded successfully. Study guide generation started.',
    })
  } catch (error: any) {
    console.error('PDF upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload PDF' },
      { status: 500 }
    )
  }
}

async function generateStudyGuide(userId: string, guideId: string, openaiFileId: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const guideRef = adminDb.doc(`users/${userId}/study-guides/${guideId}`)
  
  try {
    await guideRef.update({ status: 'processing' })

    // Use OpenAI Assistants API to process the PDF
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
              file_id: openaiFileId,
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
      } else {
        throw new Error('No content generated')
      }
    } else {
      throw new Error(`Run failed with status: ${runStatus.status}`)
    }

    // Clean up assistant
    await openai.beta.assistants.del(assistant.id)
  } catch (error: any) {
    console.error('Study guide generation error:', error)
    await guideRef.update({ status: 'error' })
    throw error
  }
}


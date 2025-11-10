import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb, adminStorage } from '@/lib/firebase/admin'
import { decrypt } from '@/lib/canvas'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Increase body size limit for file uploads
export const maxDuration = 300 // 5 minutes
export const runtime = 'nodejs'

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
    const body = await req.json()
    const { courseId, guideId, name, description, pdfPath, pdfUrl, pdfPaths, pdfUrls } = body

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 })
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Study guide name is required' }, { status: 400 })
    }

    // Support both single and multiple PDFs
    const pdfPathsArray = pdfPaths || (pdfPath ? [pdfPath] : [])
    const pdfUrlsArray = pdfUrls || (pdfUrl ? [pdfUrl] : [])

    if (pdfPathsArray.length === 0 || pdfUrlsArray.length === 0) {
      return NextResponse.json({ error: 'At least one PDF path and URL are required' }, { status: 400 })
    }

    if (pdfPathsArray.length !== pdfUrlsArray.length) {
      return NextResponse.json({ error: 'PDF paths and URLs arrays must have the same length' }, { status: 400 })
    }

    if (!guideId) {
      return NextResponse.json({ error: 'Guide ID is required' }, { status: 400 })
    }

    // Fetch course assignments for focus markers
    const privSnap = await adminDb.doc(`users/${user.uid}/private/canvas`).get()
    if (!privSnap.exists) {
      return NextResponse.json({ error: 'Canvas not connected' }, { status: 400 })
    }

    const { token: enc, baseUrl } = privSnap.data() as any
    const { access_token } = JSON.parse(decrypt(enc)) as { access_token: string }

    // Fetch assignments, course info, modules, and syllabus
    const [assignmentsRes, courseRes, modulesRes, pagesRes] = await Promise.all([
      canvasFetch<any[]>(
        baseUrl,
        `/api/v1/courses/${courseId}/assignments`,
        access_token
      ).catch(() => []),
      canvasFetch<any>(
        baseUrl,
        `/api/v1/courses/${courseId}`,
        access_token
      ).catch(() => null),
      canvasFetch<any[]>(
        baseUrl,
        `/api/v1/courses/${courseId}/modules?per_page=100`,
        access_token
      ).catch(() => []),
      canvasFetch<any[]>(
        baseUrl,
        `/api/v1/courses/${courseId}/pages?per_page=100`,
        access_token
      ).catch(() => []),
    ])

    // Fetch module items for each module
    const modulesWithItems = await Promise.all(
      modulesRes.map(async (module: any) => {
        try {
          const items = await canvasFetch<any[]>(
            baseUrl,
            `/api/v1/courses/${courseId}/modules/${module.id}/items?per_page=100`,
            access_token
          ).catch(() => [])
          return { ...module, items }
        } catch {
          return { ...module, items: [] }
        }
      })
    )

    // Try to get syllabus
    let syllabus = null
    try {
      if (courseRes?.syllabus_body) {
        syllabus = courseRes.syllabus_body
      } else {
        const syllabusPage = pagesRes.find((p: any) => p.url === 'syllabus' || p.title?.toLowerCase().includes('syllabus'))
        if (syllabusPage) {
          try {
            const syllabusContent = await canvasFetch<any>(
              baseUrl,
              `/api/v1/courses/${courseId}/pages/${syllabusPage.url}`,
              access_token
            ).catch(() => null)
            if (syllabusContent?.body) {
              syllabus = syllabusContent.body
            }
          } catch {
            // Syllabus fetch failed
          }
        }
      }
    } catch {
      // Syllabus fetch failed
    }

    const now = new Date()
    const focusAssignments = assignmentsRes
      .filter(a => {
        if (!a.due_at) return false
        const dueDate = new Date(a.due_at)
        const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysDiff >= -14 && daysDiff <= 30 // Recent (past 2 weeks) and upcoming (next 30 days)
      })
      .map(a => ({
        name: a.name,
        dueAt: a.due_at ? new Date(a.due_at).toISOString() : null,
        pointsPossible: a.points_possible || 0,
      }))

    const openaiFileIds: string[] = []

    // Download all files from Firebase Storage and upload to OpenAI
    if (pdfPathsArray.length > 0) {
      // Get Firebase Storage bucket
      let bucket
      try {
        bucket = adminStorage.bucket()
        if (!bucket) {
          const bucketNameFromEnv = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '')
          const defaultBucketName = 
            bucketNameFromEnv ||
            (process.env.FIREBASE_PROJECT_ID ? `${process.env.FIREBASE_PROJECT_ID}.appspot.com` : null)
          
          if (defaultBucketName) {
            bucket = adminStorage.bucket(defaultBucketName)
          } else {
            throw new Error('Firebase Storage bucket not configured')
          }
        }
      } catch (err: any) {
        console.error('Error accessing Firebase Storage:', err)
        return NextResponse.json(
          { error: err.message || 'Firebase Storage not configured' },
          { status: 500 }
        )
      }

      // Download all files from Firebase Storage and upload to OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      
      for (let i = 0; i < pdfPathsArray.length; i++) {
        const pdfPath = pdfPathsArray[i]
        const pdfUrl = pdfUrlsArray[i]
        
        // Download file from Firebase Storage using the signed URL
        let fileBuffer: Buffer
        try {
          const downloadResponse = await fetch(pdfUrl)
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download from signed URL: ${downloadResponse.statusText}`)
          }
          const arrayBuffer = await downloadResponse.arrayBuffer()
          fileBuffer = Buffer.from(arrayBuffer)
        } catch (urlError) {
          // Fallback to admin SDK download
          console.warn('Signed URL download failed, using admin SDK:', urlError)
          const storageFile = bucket.file(pdfPath)
          const [buffer] = await storageFile.download()
          fileBuffer = buffer
        }
        
        // Check file size
        const fileSizeMB = fileBuffer.length / (1024 * 1024)
        console.log(`Downloaded file ${i + 1}/${pdfPathsArray.length}: ${fileSizeMB.toFixed(2)}MB`)
        
        if (fileSizeMB > 100) {
          return NextResponse.json(
            { error: `File ${i + 1} size (${fileSizeMB.toFixed(2)}MB) exceeds 100MB limit for OpenAI` },
            { status: 400 }
          )
        }

        // Upload to OpenAI Files API
        const fileName = pdfPath.split('/').pop() || `study-guide-${i + 1}.pdf`
        
        try {
          const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}-${fileName}`)
          fs.writeFileSync(tempFilePath, fileBuffer)
          
          try {
            const openaiFile = await openai.files.create({
              file: fs.createReadStream(tempFilePath),
              purpose: 'assistants',
            })
            openaiFileIds.push(openaiFile.id)
            console.log(`Successfully uploaded file ${i + 1} to OpenAI, file ID: ${openaiFile.id}`)
          } finally {
            try {
              fs.unlinkSync(tempFilePath)
            } catch (cleanupError) {
              console.warn('Failed to cleanup temp file:', cleanupError)
            }
          }
        } catch (openaiError: any) {
          console.error(`OpenAI upload error for file ${i + 1}:`, openaiError.message)
          if (openaiError.status === 413) {
            return NextResponse.json(
              { error: `File ${i + 1} size exceeds OpenAI's limit. Please compress the PDF.` },
              { status: 413 }
            )
          }
          throw openaiError
        }
      }
    }

    // Prepare Canvas materials context
    const canvasMaterialsContext = {
      modules: modulesWithItems.map((m: any) => ({
        name: m.name,
        position: m.position || 0,
        items: (m.items || []).map((item: any) => ({
          title: item.title,
          type: item.type,
        })),
      })),
      syllabus: syllabus ? (syllabus.length > 5000 ? syllabus.substring(0, 5000) + '...' : syllabus) : null,
      totalModules: modulesWithItems.length,
      totalModuleItems: modulesWithItems.reduce((sum, m) => sum + (m.items?.length || 0), 0),
    }

    // Create study guide document
    const guideData = {
      id: guideId,
      userId: user.uid,
      name: name.trim(),
      description: description?.trim() || null,
      pdfPath: pdfPathsArray.length === 1 ? pdfPathsArray[0] : null, // Keep single for backward compatibility
      pdfUrl: pdfUrlsArray.length === 1 ? pdfUrlsArray[0] : null,
      pdfPaths: pdfPathsArray,
      pdfUrls: pdfUrlsArray,
      openaiFileId: openaiFileIds.length === 1 ? openaiFileIds[0] : null, // Keep single for backward compatibility
      openaiFileIds: openaiFileIds,
      associationType: 'course' as const,
      associationId: courseId,
      associationName: courseRes?.name || '',
      courseId: courseId,
      assignmentContext: focusAssignments,
      canvasMaterialsContext: canvasMaterialsContext,
      aiContent: '',
      aiGeneratedAt: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'uploading' as const,
    }

    const guideRef = adminDb.doc(`users/${user.uid}/study-guides/${guideId}`)
    await guideRef.set(guideData)

    // Generate study guide with assignment context and Canvas materials
    if (openaiFileIds.length > 0) {
      generateStudyGuideFromCourse(
        user.uid,
        guideId,
        openaiFileIds,
        focusAssignments,
        courseRes?.name || '',
        canvasMaterialsContext
      ).catch(err => {
        console.error('Error generating study guide:', err)
        guideRef.update({ status: 'error' })
      })
    } else {
      return NextResponse.json(
        { error: 'At least one PDF upload is required.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      guideId,
      status: 'uploading',
      message: 'Study guide generation started with course assignment context.',
    })
  } catch (error: any) {
    console.error('Study guide generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate study guide' },
      { status: 500 }
    )
  }
}

async function generateStudyGuideFromCourse(
  userId: string,
  guideId: string,
  openaiFileIds: string[],
  assignments: Array<{ name: string; dueAt: string | null; pointsPossible: number }>,
  courseName: string,
  canvasMaterials?: {
    modules: Array<{ name: string; position: number; items: Array<{ title: string; type: string }> }>
    syllabus: string | null
    totalModules: number
    totalModuleItems: number
  }
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const guideRef = adminDb.doc(`users/${userId}/study-guides/${guideId}`)

  try {
    await guideRef.update({ status: 'processing' })

    // Build assignment context for the prompt
    const assignmentContext = assignments.length > 0
      ? `\n\nIMPORTANT: Focus on these recent and upcoming assignments as priority areas:\n${assignments
          .map((a, idx) => {
            const dueDate = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : 'No due date'
            return `${idx + 1}. ${a.name} (Due: ${dueDate}${a.pointsPossible > 0 ? `, ${a.pointsPossible} points` : ''})`
          })
          .join('\n')}\n\nPrioritize content in the PDFs that relates to these assignments.`
      : ''

    // Build Canvas materials context
    let canvasContext = ''
    if (canvasMaterials) {
      if (canvasMaterials.modules.length > 0) {
        canvasContext += `\n\nCOURSE STRUCTURE (from Canvas modules):\n`
        canvasMaterials.modules.forEach((module, idx) => {
          canvasContext += `\nModule ${idx + 1}: ${module.name}\n`
          if (module.items.length > 0) {
            canvasContext += `  Topics covered:\n`
            module.items.forEach(item => {
              canvasContext += `    - ${item.title} (${item.type})\n`
            })
          }
        })
        canvasContext += `\nUse this course structure to organize the study guide and ensure all topics are covered.\n`
      }
      
      if (canvasMaterials.syllabus) {
        canvasContext += `\n\nCOURSE SYLLABUS INFORMATION:\n${canvasMaterials.syllabus.substring(0, 2000)}${canvasMaterials.syllabus.length > 2000 ? '...' : ''}\n\nUse syllabus information to understand course objectives, grading policies, and key topics.\n`
      }
    }

    const assistant = await openai.beta.assistants.create({
      name: 'Course Study Guide Generator',
      instructions: `You are an expert at creating comprehensive, detailed study guides from PDF documents for the course "${courseName}". 

Your task is to create an exceptionally thorough and well-organized study guide that:
1. Extracts ALL key concepts, definitions, theorems, formulas, and important information
2. Creates detailed summaries with examples and explanations
3. Organizes content logically by topic and module (if provided)
4. Generates practice questions and exercises with solutions
5. Includes visual aids, diagrams, and organizational tips
6. Makes content ADHD-friendly with clear structure, bullet points, and visual breaks
7. Cross-references related concepts across different sections
8. Provides study strategies and memory techniques
9. Includes comprehensive review checklists
10. Incorporates assignment focus areas and course structure from Canvas${assignmentContext}${canvasContext}

Format the output in clear markdown with proper headers, subheaders, bullet points, and visual organization. Be extremely thorough and detailed - this should be a comprehensive reference document.`,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
    })

    const prompt = `Please analyze ${openaiFileIds.length === 1 ? 'this PDF' : `these ${openaiFileIds.length} PDFs`} and create a comprehensive, detailed study guide for ${courseName}.

REQUIREMENTS:
1. **Key Concepts & Definitions**: Extract and explain ALL important concepts, definitions, theorems, and principles. Include examples for each.

2. **Main Topics & Organization**: Organize content by major topics and subtopics. If Canvas module structure is provided, align the organization with course modules.

3. **Formulas & Equations**: If applicable, list ALL formulas and equations with explanations of when and how to use them. Include derivations where helpful.

4. **Practice Questions**: Generate multiple practice questions for each major topic, including:
   - Conceptual questions
   - Problem-solving exercises
   - Application scenarios
   - Solutions with step-by-step explanations

5. **Summary Points**: Create detailed summary sections for each major topic with key takeaways.

6. **Visual Organization**: Use clear markdown formatting with:
   - Hierarchical headers (##, ###, ####)
   - Bullet points and numbered lists
   - Tables for comparisons
   - Code blocks for formulas
   - Visual breaks between sections

7. **Study Strategies**: Include study tips, memory techniques, and review strategies specific to this course.

8. **Review Checklists**: Create comprehensive checklists for each major topic to help track study progress.

9. **Cross-References**: Link related concepts across different sections.

10. **Assignment Focus**: ${assignments.length > 0 ? 'Pay special attention to content related to the assignments listed above.' : 'Cover all course material comprehensively.'}${canvasContext}

Format the output in clear markdown with proper structure. Be extremely thorough - this should serve as a complete reference guide for the course.`

    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: 'user',
          content: prompt,
          attachments: openaiFileIds.map(fileId => ({
            file_id: fileId,
            tools: [{ type: 'file_search' }],
          })),
        },
      ],
    })

    // Keep explicit reference to thread object to prevent garbage collection
    const threadRef = thread
    const threadIdValue = threadRef.id
    
    if (!threadIdValue) {
      throw new Error('Thread creation failed: no thread ID returned')
    }

    const run = await openai.beta.threads.runs.create(threadIdValue, {
      assistant_id: assistant.id,
    })

    // Keep explicit reference to run object
    const runRef = run
    const runIdValue = runRef.id
    
    if (!runIdValue) {
      throw new Error('Run creation failed: no run ID returned')
    }

    console.log(`Created thread: ${threadIdValue}, run: ${runIdValue}`)

    // Poll for completion - use REST API directly to avoid SDK issues
    const apiKey = process.env.OPENAI_API_KEY!
    let runStatus: any
    
    while (true) {
      const response = await fetch(`https://api.openai.com/v1/threads/${threadIdValue}/runs/${runIdValue}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
      }
      
      runStatus = await response.json()
      
      if (runStatus.status === 'completed' || runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
        break
      }
      
      if (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        break
      }
    }

    if (runStatus.status === 'completed') {
      // Get messages using REST API directly
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadIdValue}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      })
      
      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text()
        throw new Error(`OpenAI API error ${messagesResponse.status}: ${errorText}`)
      }
      
      const messagesData = await messagesResponse.json()
      const assistantMessage = messagesData.data?.find((m: any) => m.role === 'assistant')

      if (assistantMessage && assistantMessage.content?.[0]?.type === 'text') {
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

    // Clean up assistant using REST API
    try {
      await fetch(`https://api.openai.com/v1/assistants/${assistant.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      })
    } catch (cleanupError) {
      // Don't fail if cleanup fails
      console.warn('Failed to cleanup assistant:', cleanupError)
    }
  } catch (error: any) {
    console.error('Study guide generation error:', error)
    await guideRef.update({ status: 'error' })
    throw error
  }
}


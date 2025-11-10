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
    // Fetch files, modules, pages, and syllabus for the course
    const [files, modules, pages, courseInfo] = await Promise.all([
      canvasFetch<any[]>(
        baseUrl,
        `/api/v1/courses/${courseId}/files?per_page=100`,
        access_token
      ).catch(() => []),
      canvasFetch<any[]>(
        baseUrl,
        `/api/v1/courses/${courseId}/modules?per_page=100&include[]=items`,
        access_token
      ).catch(() => []),
      canvasFetch<any[]>(
        baseUrl,
        `/api/v1/courses/${courseId}/pages?per_page=100`,
        access_token
      ).catch(() => []),
      canvasFetch<any>(
        baseUrl,
        `/api/v1/courses/${courseId}`,
        access_token
      ).catch(() => null),
    ])

    // Fetch module items for each module
    const modulesWithItems = await Promise.all(
      modules.map(async (module: any) => {
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

    // Fetch syllabus if available
    let syllabus = null
    try {
      if (courseInfo?.syllabus_body) {
        syllabus = {
          body: courseInfo.syllabus_body,
          courseId: courseId,
        }
      } else {
        // Try fetching syllabus page
        const syllabusPage = pages.find((p: any) => p.url === 'syllabus' || p.title?.toLowerCase().includes('syllabus'))
        if (syllabusPage) {
          try {
            const syllabusContent = await canvasFetch<any>(
              baseUrl,
              `/api/v1/courses/${courseId}/pages/${syllabusPage.url}`,
              access_token
            ).catch(() => null)
            if (syllabusContent?.body) {
              syllabus = {
                body: syllabusContent.body,
                title: syllabusContent.title,
                url: syllabusContent.url,
              }
            }
          } catch {
            // Syllabus page fetch failed, continue without it
          }
        }
      }
    } catch {
      // Syllabus fetch failed, continue without it
    }

    // Process files
    const processedFiles = files.map((f: any) => ({
      id: f.id.toString(),
      displayName: f.display_name,
      filename: f.filename,
      contentType: f['content-type'] || '',
      size: f.size || 0,
      url: f.url,
      createdAt: f.created_at ? new Date(f.created_at).toISOString() : null,
      updatedAt: f.updated_at ? new Date(f.updated_at).toISOString() : null,
      isPdf: (f['content-type'] || '').includes('pdf') || f.filename?.toLowerCase().endsWith('.pdf'),
    }))

    // Process modules with items
    const processedModules = modulesWithItems.map((m: any) => ({
      id: m.id.toString(),
      name: m.name,
      position: m.position || 0,
      published: m.published || false,
      itemsCount: m.items_count || 0,
      items: (m.items || []).map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        type: item.type,
        contentId: item.content_id?.toString(),
        url: item.url,
        htmlUrl: item.html_url,
        position: item.position || 0,
        indent: item.indent || 0,
        published: item.published || false,
      })),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : null,
      updatedAt: m.updated_at ? new Date(m.updated_at).toISOString() : null,
    }))

    // Process pages
    const processedPages = pages.map((p: any) => ({
      id: p.page_id || p.url,
      title: p.title,
      url: p.url,
      published: p.published || false,
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : null,
      updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : null,
    }))

    return NextResponse.json({
      ok: true,
      materials: {
        files: processedFiles,
        modules: processedModules,
        pages: processedPages,
        syllabus: syllabus,
      },
      summary: {
        totalFiles: processedFiles.length,
        pdfFiles: processedFiles.filter(f => f.isPdf).length,
        totalModules: processedModules.length,
        totalModuleItems: processedModules.reduce((sum, m) => sum + (m.items?.length || 0), 0),
        totalPages: processedPages.length,
        hasSyllabus: !!syllabus,
      },
    })
  } catch (error: any) {
    console.error('Error fetching Canvas materials:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch course materials' },
      { status: 500 }
    )
  }
}


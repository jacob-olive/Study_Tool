import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { adminDb, adminStorage } from '@/lib/firebase/admin'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const guideRef = adminDb.doc(`users/${user.uid}/study-guides/${params.id}`)
    const guideSnap = await guideRef.get()

    if (!guideSnap.exists) {
      return NextResponse.json({ error: 'Study guide not found' }, { status: 404 })
    }

    const guide = guideSnap.data()
    return NextResponse.json({
      ok: true,
      guide,
    })
  } catch (error: any) {
    console.error('Error fetching study guide:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch study guide' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const params = await context.params
    const guideRef = adminDb.doc(`users/${user.uid}/study-guides/${params.id}`)
    const guideSnap = await guideRef.get()

    if (!guideSnap.exists) {
      return NextResponse.json({ error: 'Study guide not found' }, { status: 404 })
    }

    const guide = guideSnap.data()
    
    // Delete PDF from Firebase Storage
    if (guide?.pdfPath) {
      try {
        let bucket = adminStorage.bucket()
        if (!bucket) {
          const defaultBucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
          if (defaultBucketName) {
            bucket = adminStorage.bucket(defaultBucketName)
          }
        }
        if (bucket) {
          const file = bucket.file(guide.pdfPath)
          await file.delete().catch(err => {
            console.error('Error deleting PDF from storage:', err)
            // Continue even if storage delete fails
          })
        }
      } catch (err) {
        console.error('Error accessing Firebase Storage:', err)
        // Continue even if storage access fails
      }
    }

    // Delete Firestore document
    await guideRef.delete()

    return NextResponse.json({
      ok: true,
      message: 'Study guide deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting study guide:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete study guide' },
      { status: 500 }
    )
  }
}


'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { TextInput } from '@/components/input'
import { auth, storage } from '@/lib/firebase/client'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import { v4 as uuidv4 } from 'uuid'

type Course = {
  id: string
  name: string
  courseCode: string
  enrollmentState: 'active' | 'completed'
}

type Assignment = {
  id: string
  name: string
  dueAt: string | null
  pointsPossible: number
  submissionTypes: string[]
  htmlUrl: string
  description: string
}

type CourseStudyGuideGeneratorProps = {
  courseId: string
  onBack: () => void
}

export default function CourseStudyGuideGenerator({ courseId, onBack }: CourseStudyGuideGeneratorProps) {
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<{
    recent: Assignment[]
    upcoming: Assignment[]
    past: Assignment[]
  } | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadCourseData = async () => {
      const user = auth.currentUser
      if (!user) return

      setLoading(true)
      setError(null)

      try {
        const idToken = await user.getIdToken()

        // Fetch course details
        const coursesRes = await fetch('/api/canvas/courses', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json()
          const foundCourse = coursesData.courses?.find((c: Course) => c.id === courseId)
          if (foundCourse) {
            setCourse(foundCourse)
            setName(`${foundCourse.name} Study Guide`)
          }
        }

        // Fetch assignments
        const assignmentsRes = await fetch(`/api/canvas/courses/${courseId}/assignments`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
        if (assignmentsRes.ok) {
          const assignmentsData = await assignmentsRes.json()
          setAssignments(assignmentsData.assignments)
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load course data')
        console.error('Error loading course data:', err)
      } finally {
        setLoading(false)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadCourseData()
      }
    })

    return () => unsubscribe()
  }, [courseId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      const validFiles: File[] = []
      for (const file of selectedFiles) {
        if (file.type !== 'application/pdf') {
          setError(`"${file.name}" is not a PDF file. Only PDF files are supported.`)
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          setError(`"${file.name}" is too large. File size must be less than 10MB.`)
          continue
        }
        validFiles.push(file)
      }
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles])
        setError(null)
      }
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a study guide name')
      return
    }

    if (files.length === 0) {
      setError('Please upload at least one PDF file')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setError('Please sign in to generate study guides')
      return
    }

    setGenerating(true)
    setError(null)
    setSuccess(false)

    try {
      const idToken = await user.getIdToken()
      const guideId = uuidv4()
      
      // Upload all files to Firebase Storage
      const pdfPaths: string[] = []
      const pdfUrls: string[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileId = uuidv4()
        const pdfPath = `users/${user.uid}/study-guides/${guideId}/${fileId}.pdf`
        
        const storageRef = ref(storage, pdfPath)
        await uploadBytes(storageRef, file, {
          contentType: 'application/pdf',
        })
        
        const pdfUrl = await getDownloadURL(storageRef)
        pdfPaths.push(pdfPath)
        pdfUrls.push(pdfUrl)
      }
      
      // Now send metadata to API (no files in request body)
      const res = await fetch('/api/study-guides/generate-from-course', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          guideId,
          name: name.trim(),
          description: description.trim() || null,
          pdfPaths,
          pdfUrls,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setFiles([])
        setName('')
        setDescription('')
        const fileInput = document.getElementById('pdf-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        
        setTimeout(() => {
          setSuccess(false)
          // Optionally redirect or refresh the list
        }, 5000)
      } else {
        setError(data.error || 'Failed to generate study guide')
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'An error occurred during upload')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading course data...</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-red-600 dark:text-red-400">Course not found</p>
        <Button onClick={onBack} className="mt-4">Go Back</Button>
      </div>
    )
  }

  const focusAssignments = [
    ...(assignments?.recent || []),
    ...(assignments?.upcoming || []),
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-950/10 p-6 space-y-4 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-950 dark:text-white">{course.name}</h2>
            {course.courseCode && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{course.courseCode}</p>
            )}
          </div>
          <Button onClick={onBack} type="button">Change Course</Button>
        </div>
      </div>

      {focusAssignments.length > 0 && (
        <div className="rounded-lg border border-gray-950/10 p-6 space-y-4 dark:border-white/10">
          <div>
            <h3 className="text-lg font-medium text-gray-950 dark:text-white">
              Focus Assignments
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              These recent and upcoming assignments will guide what to focus on in your study guide.
            </p>
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {assignments?.upcoming && assignments.upcoming.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-950 dark:text-white mb-2">
                  Upcoming ({assignments.upcoming.length})
                </h4>
                <div className="space-y-2">
                  {assignments.upcoming.map(assignment => (
                    <div
                      key={assignment.id}
                      className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-950 dark:text-white">
                            {assignment.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Due: {formatDate(assignment.dueAt)}
                            {assignment.pointsPossible > 0 && ` • ${assignment.pointsPossible} points`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignments?.recent && assignments.recent.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-950 dark:text-white mb-2">
                  Recent ({assignments.recent.length})
                </h4>
                <div className="space-y-2">
                  {assignments.recent.map(assignment => (
                    <div
                      key={assignment.id}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-950 dark:text-white">
                            {assignment.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Due: {formatDate(assignment.dueAt)}
                            {assignment.pointsPossible > 0 && ` • ${assignment.pointsPossible} points`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-950/10 p-6 space-y-4 dark:border-white/10">
        <h3 className="text-lg font-medium text-gray-950 dark:text-white">Create Study Guide</h3>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-400">
              Study guide generation started! This may take a few minutes. Check your study guides list for updates.
            </p>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
              Study Guide Name *
            </label>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Calculus Midterm Review"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
              Description (optional)
            </label>
            <TextInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this study guide"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
              Upload PDFs * (Multiple files supported)
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Upload one or more PDF files containing course materials. The study guide will be generated from all uploaded PDFs, incorporating Canvas course materials, modules, and syllabus information, focusing on content related to your recent and upcoming assignments.
            </p>
            <input
              id="pdf-file"
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              required
              className="block w-full text-sm text-gray-600 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900/30 dark:file:text-blue-300"
            />
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-gray-950 dark:text-white">
                  Selected Files ({files.length}):
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-white/10"
                    >
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
            <Button type="button" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" disabled={generating || !name.trim() || files.length === 0}>
              {generating ? 'Generating...' : 'Generate Study Guide'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}


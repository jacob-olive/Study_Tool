'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { TextInput } from '@/components/input'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, getDocs } from 'firebase/firestore'

type Course = {
  id: string
  name: string
}

type Task = {
  id: string
  title: string
  courseName?: string
}

export default function StudyGuideUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [associationType, setAssociationType] = useState<'course' | 'task' | 'general'>('general')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const user = auth.currentUser
      if (!user) return

      try {
        // Load courses
        const idToken = await user.getIdToken()
        const coursesRes = await fetch('/api/canvas/courses', {
          headers: { 'Authorization': `Bearer ${idToken}` }
        })
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json()
          setCourses(coursesData.courses || [])
        }

        // Load tasks
        const tasksRef = collection(db, 'users', user.uid, 'plans', 'active', 'tasks')
        const tasksSnap = await getDocs(tasksRef)
        const tasksData = tasksSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Task))
        setTasks(tasksData)
      } catch (err) {
        console.error('Error loading data:', err)
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadData()
      }
    })

    return () => unsubscribe()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are supported')
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError(null)
      if (!name) {
        setName(selectedFile.name.replace('.pdf', ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) {
      setError('Please select a PDF file and enter a name')
      return
    }

    const user = auth.currentUser
    if (!user) {
      setError('Please sign in to upload study guides')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name.trim())
      if (description.trim()) {
        formData.append('description', description.trim())
      }
      formData.append('associationType', associationType)
      
      let associationId = ''
      let associationName = ''
      
      if (associationType === 'course' && selectedCourseId) {
        associationId = selectedCourseId
        const course = courses.find(c => c.id === selectedCourseId)
        associationName = course?.name || ''
        formData.append('associationId', associationId)
        formData.append('associationName', associationName)
      } else if (associationType === 'task' && selectedTaskId) {
        associationId = selectedTaskId
        const task = tasks.find(t => t.id === selectedTaskId)
        associationName = task?.title || ''
        formData.append('associationId', associationId)
        formData.append('associationName', associationName)
      }

      const res = await fetch('/api/study-guides/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        setFile(null)
        setName('')
        setDescription('')
        setAssociationType('general')
        setSelectedCourseId('')
        setSelectedTaskId('')
        // Reset file input
        const fileInput = document.getElementById('pdf-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        
        setTimeout(() => setSuccess(false), 5000)
      } else {
        setError(data.error || 'Failed to upload PDF')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-6 space-y-4 dark:border-white/10">
      <h2 className="text-xl font-semibold text-gray-950 dark:text-white">Upload Study Guide</h2>
      
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-800 dark:text-green-400">
            PDF uploaded successfully! Study guide generation started. This may take a few minutes.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
            PDF File *
          </label>
          <input
            id="pdf-file"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              dark:file:bg-blue-900/30 dark:file:text-blue-300"
            required
          />
          {file && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

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
            Associate With
          </label>
          <select
            value={associationType}
            onChange={(e) => {
              setAssociationType(e.target.value as 'course' | 'task' | 'general')
              setSelectedCourseId('')
              setSelectedTaskId('')
            }}
            className="block w-full rounded-lg bg-white px-3 py-1.5 text-base/6 text-gray-950 sm:text-sm/6 dark:text-white outline -outline-offset-1 outline-gray-950/15 focus:outline-2 focus:outline-blue-500 dark:bg-white/10 dark:outline-white/15"
          >
            <option value="general">General Study Guide</option>
            <option value="course">Specific Course</option>
            <option value="task">Specific Task/Assignment</option>
          </select>
        </div>

        {associationType === 'course' && (
          <div>
            <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
              Select Course
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="block w-full rounded-lg bg-white px-3 py-1.5 text-base/6 text-gray-950 sm:text-sm/6 dark:text-white outline -outline-offset-1 outline-gray-950/15 focus:outline-2 focus:outline-blue-500 dark:bg-white/10 dark:outline-white/15"
              required
            >
              <option value="">Select a course...</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
        )}

        {associationType === 'task' && (
          <div>
            <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
              Select Task
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="block w-full rounded-lg bg-white px-3 py-1.5 text-base/6 text-gray-950 sm:text-sm/6 dark:text-white outline -outline-offset-1 outline-gray-950/15 focus:outline-2 focus:outline-blue-500 dark:bg-white/10 dark:outline-white/15"
              required
            >
              <option value="">Select a task...</option>
              {tasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title} {task.courseName ? `(${task.courseName})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={uploading || !file || !name.trim()}>
            {uploading ? 'Uploading...' : 'Upload & Generate Study Guide'}
          </Button>
        </div>
      </form>
    </div>
  )
}


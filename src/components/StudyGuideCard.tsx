'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/button'
import { auth } from '@/lib/firebase/client'
import type { StudyGuide } from '@/lib/schema'

type StudyGuideCardProps = {
  guide: StudyGuide
  onDelete: (id: string) => void
  onRegenerate: (id: string) => void
}

export default function StudyGuideCard({ guide, onDelete, onRegenerate }: StudyGuideCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const formatStudyGuide = (text: string) => {
    if (!text) return null

    return text.split('\n').map((line, index) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={index} className="mt-6 mb-2 text-lg font-semibold text-gray-950 dark:text-white">
            {line.replace('### ', '')}
          </h3>
        )
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={index} className="mt-6 mb-3 text-xl font-semibold text-gray-950 dark:text-white">
            {line.replace('## ', '')}
          </h2>
        )
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={index} className="mt-6 mb-4 text-2xl font-bold text-gray-950 dark:text-white">
            {line.replace('# ', '')}
          </h1>
        )
      }

      const boldRegex = /\*\*(.+?)\*\*/g
      let formattedLine = line

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2)
        if (boldRegex.test(content)) {
          const parts = content.split(boldRegex)
          return (
            <li key={index} className="ml-4 mb-1 text-gray-700 dark:text-gray-300">
              {parts.map((part, i) =>
                i % 2 === 1 ? (
                  <strong key={i} className="font-semibold text-gray-950 dark:text-white">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </li>
          )
        }
        return (
          <li key={index} className="ml-4 mb-1 text-gray-700 dark:text-gray-300">
            {content}
          </li>
        )
      }

      if (boldRegex.test(formattedLine)) {
        const parts = formattedLine.split(boldRegex)
        return (
          <p key={index} className="mb-2 text-gray-700 dark:text-gray-300">
            {parts.map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="font-semibold text-gray-950 dark:text-white">
                  {part}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        )
      }

      if (line.trim() === '') {
        return <div key={index} className="h-2" />
      }

      return (
        <p key={index} className="mb-2 text-gray-700 dark:text-gray-300">
          {line}
        </p>
      )
    })
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        alert('Please sign in')
        return
      }

      const res = await fetch('/api/study-guides/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ guideId: guide.id }),
      })

      if (res.ok) {
        alert('Study guide regeneration started. This may take a few minutes.')
        onRegenerate(guide.id)
      } else {
        const data = await res.json()
        alert(`Failed to regenerate: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to regenerate'}`)
    } finally {
      setRegenerating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this study guide? This cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        alert('Please sign in')
        return
      }

      const res = await fetch(`/api/study-guides/${guide.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      if (res.ok) {
        onDelete(guide.id)
      } else {
        const data = await res.json()
        alert(`Failed to delete: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to delete'}`)
    } finally {
      setDeleting(false)
    }
  }

  const getStatusBadge = () => {
    const statusColors = {
      uploading: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[guide.status]}`}>
        {guide.status.charAt(0).toUpperCase() + guide.status.slice(1)}
      </span>
    )
  }

  const getAssociationBadge = () => {
    if (guide.associationType === 'general') return null
    const colors = {
      course: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      task: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[guide.associationType]}`}>
        {guide.associationType === 'course' ? 'Course' : 'Task'}: {guide.associationName || 'Unknown'}
      </span>
    )
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-6 space-y-4 dark:border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-950 dark:text-white">{guide.name}</h3>
            {getStatusBadge()}
            {getAssociationBadge()}
          </div>
          {guide.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{guide.description}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Created {new Date(guide.createdAt).toLocaleString()}
            {guide.aiGeneratedAt > 0 && (
              <> • Generated {new Date(guide.aiGeneratedAt).toLocaleString()}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {guide.status === 'ready' && (
            <Link
              href={`/study-guides/${guide.id}`}
              className="px-3 py-1.5 text-sm rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            >
              View & Schedule
            </Link>
          )}
          <a
            href={guide.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Download PDF
          </a>
          {guide.status === 'ready' && (
            <Button onClick={handleRegenerate} disabled={regenerating} className="text-sm">
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </Button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-sm rounded-full bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {guide.status === 'ready' && guide.aiContent && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {expanded ? 'Hide Study Guide' : 'Show Study Guide'}
          </button>
          {expanded && (
            <div className="mt-4 prose prose-sm max-w-none dark:prose-invert">
              {formatStudyGuide(guide.aiContent)}
            </div>
          )}
        </div>
      )}

      {guide.status === 'error' && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-400">
            Failed to generate study guide. You can try regenerating it.
          </p>
        </div>
      )}

      {(guide.status === 'uploading' || guide.status === 'processing') && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
          {guide.status === 'uploading' ? 'Uploading PDF...' : 'Generating study guide...'}
        </div>
      )}
    </div>
  )
}


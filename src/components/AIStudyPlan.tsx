'use client'

import { useState } from 'react'
import { Button } from '@/components/button'
import { auth } from '@/lib/firebase/client'

type AIStudyPlanProps = {
  initialPlan?: string
  initialGeneratedAt?: number
}

export default function AIStudyPlan({ initialPlan, initialGeneratedAt }: AIStudyPlanProps) {
  const [studyPlan, setStudyPlan] = useState(initialPlan || '')
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt || 0)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        setError('Please sign in to generate a study plan')
        return
      }

      const res = await fetch('/api/plan/ai-generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      const data = await res.json()

      if (res.ok) {
        setStudyPlan(data.studyPlan)
        setGeneratedAt(Date.now())
      } else {
        setError(data.error || 'Failed to generate study plan')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setGenerating(false)
    }
  }

  // Convert markdown-style text to formatted HTML
  const formatStudyPlan = (text: string) => {
    if (!text) return null

    return text.split('\n').map((line, index) => {
      // Headers
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

      // Bold text
      const boldRegex = /\*\*(.+?)\*\*/g
      let formattedLine = line

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2)
        // Check if it contains bold text
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

      // Regular paragraphs with bold text
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

      // Empty lines
      if (line.trim() === '') {
        return <div key={index} className="h-2" />
      }

      // Regular text
      return (
        <p key={index} className="mb-2 text-gray-700 dark:text-gray-300">
          {line}
        </p>
      )
    })
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
            AI Study Plan
          </h2>
          {generatedAt > 0 && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : studyPlan ? 'Regenerate' : 'Generate AI Plan'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {!studyPlan && !generating && !error && (
        <div className="py-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Click "Generate AI Plan" to create a personalized study strategy based on your Canvas assignments.
          </p>
        </div>
      )}

      {generating && (
        <div className="py-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Analyzing your coursework and generating personalized recommendations...
          </p>
        </div>
      )}

      {studyPlan && !generating && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {formatStudyPlan(studyPlan)}
        </div>
      )}
    </div>
  )
}


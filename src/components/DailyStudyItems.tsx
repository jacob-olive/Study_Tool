'use client'

import { useState } from 'react'
import { auth } from '@/lib/firebase/client'
import type { StudyItem } from '@/lib/schema'
import { format, parseISO } from 'date-fns'

type DailyStudyItemsProps = {
  items: StudyItem[]
  date: string // ISO date string
  onItemComplete: (itemId: string, completed: boolean) => Promise<void>
}

export default function DailyStudyItems({ items, date, onItemComplete }: DailyStudyItemsProps) {
  const [completing, setCompleting] = useState<Set<string>>(new Set())

  const handleToggleComplete = async (itemId: string, currentlyCompleted: boolean) => {
    setCompleting(prev => new Set(prev).add(itemId))
    try {
      await onItemComplete(itemId, !currentlyCompleted)
    } catch (error) {
      console.error('Error updating item:', error)
    } finally {
      setCompleting(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }

  const dateObj = parseISO(date)
  const formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy')
  const totalMinutes = items.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  const completedCount = items.filter(item => item.completedAt).length

  if (items.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-950 dark:text-white">
            {formattedDate}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} • {totalMinutes} min
            {completedCount > 0 && ` • ${completedCount}/${items.length} completed`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(item => {
          const isCompleted = !!item.completedAt
          const isCompleting = completing.has(item.id)

          return (
            <div
              key={item.id}
              className={`p-3 rounded-lg border-2 transition-colors ${
                isCompleted
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-white border-gray-200 dark:bg-white/5 dark:border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggleComplete(item.id, isCompleted)}
                  disabled={isCompleting}
                  className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-500 dark:border-gray-600'
                  } ${isCompleting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {isCompleted && (
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${
                        isCompleted
                          ? 'text-gray-600 line-through dark:text-gray-400'
                          : 'text-gray-950 dark:text-white'
                      }`}>
                        {item.section}
                      </h4>
                      <p className={`text-xs mt-1 ${
                        isCompleted
                          ? 'text-gray-500 dark:text-gray-500'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {item.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


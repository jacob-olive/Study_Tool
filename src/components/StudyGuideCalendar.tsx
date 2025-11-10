'use client'

import { useMemo } from 'react'
import { format, parseISO, startOfWeek, addDays, isSameDay, differenceInDays, startOfDay } from 'date-fns'
import type { StudySchedule, StudyItem } from '@/lib/schema'
import DailyStudyItems from './DailyStudyItems'

type StudyGuideCalendarProps = {
  schedule: StudySchedule
  onItemComplete: (itemId: string, completed: boolean) => Promise<void>
}

export default function StudyGuideCalendar({ schedule, onItemComplete }: StudyGuideCalendarProps) {
  const targetDate = parseISO(schedule.targetDate)
  const startDate = parseISO(schedule.startDate)
  const now = new Date()

  // Group items by date
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, StudyItem[]>()
    for (const item of schedule.items) {
      const dateKey = format(parseISO(item.scheduledDate), 'yyyy-MM-dd')
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(item)
    }
    return grouped
  }, [schedule.items])

  // Calculate progress
  const completedItems = schedule.items.filter(item => item.completedAt).length
  const totalItems = schedule.items.length
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0

  // Group days by week, ensuring we show all days leading up to target
  const weeks = useMemo(() => {
    const weeks: Date[][] = []
    let currentWeek: Date[] = []
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 })

    // Start from the beginning of the week containing startDate
    let currentDay = weekStart

    while (currentDay <= targetDate) {
      if (currentDay.getDay() === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek)
        currentWeek = [currentDay]
      } else {
        currentWeek.push(currentDay)
      }
      currentDay = addDays(currentDay, 1)
    }
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return weeks
  }, [startDate, targetDate])

  const daysUntilTarget = differenceInDays(targetDate, now)

  return (
    <div className="space-y-6">
      {/* Header with progress */}
      <div className="rounded-lg border border-gray-950/10 p-6 dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
              Study Schedule
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Target Date: {format(targetDate, 'EEEE, MMMM d, yyyy')}
              {daysUntilTarget > 0 && ` (${daysUntilTarget} day${daysUntilTarget !== 1 ? 's' : ''} remaining)`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-950 dark:text-white">
              {completedItems}/{totalItems}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              items completed
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Calendar view */}
      <div className="space-y-6">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="space-y-3">
            <div className="text-sm font-medium text-gray-950 dark:text-white">
              Week of {format(week[0], 'MMMM d')}
            </div>
            <div className="space-y-3">
              {week.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayItems = itemsByDate.get(dateKey) || []
                const isPast = day < startOfDay(now)
                const isToday = isSameDay(day, now)
                const isTarget = isSameDay(day, targetDate)
                const isBeforeTarget = day <= targetDate

                // Show all days from start date to target date
                if (!isBeforeTarget) {
                  return null
                }

                // Calculate total minutes for the day
                const totalMinutes = dayItems.reduce((sum, item) => sum + item.estimatedMinutes, 0)

                return (
                  <div key={dateKey}>
                    {dayItems.length > 0 ? (
                      <DailyStudyItems
                        items={dayItems}
                        date={format(day, 'yyyy-MM-dd')}
                        onItemComplete={onItemComplete}
                      />
                    ) : isTarget ? (
                      <div className="rounded-lg border-2 border-blue-500 p-4 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400">
                        <div className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                          🎯 Test/Assignment Day: {format(day, 'EEEE, MMMM d, yyyy')}
                        </div>
                      </div>
                    ) : (
                      // Show empty day card for days with no items but before target
                      <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                              {format(day, 'EEEE, MMMM d, yyyy')}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {isToday ? 'Today - No study items scheduled' : 'No study items scheduled'}
                            </p>
                          </div>
                          {isPast && (
                            <span className="text-xs text-gray-400 dark:text-gray-600">Past</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


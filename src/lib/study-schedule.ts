/**
 * Study Schedule Generator
 * Distributes study guide items across days leading to target date
 */

import { formatISO, parseISO, addDays, startOfDay, differenceInDays, isBefore, isAfter } from 'date-fns'
import type { Availability } from './scheduling'
import type { StudyItem, StudySchedule } from './schema'
import { parseStudyGuideContent, estimateTotalTime, type ParsedStudyItem } from './study-guide-parser'

export type ScheduleOptions = {
  targetDate: string // ISO date string
  startDate?: string // ISO date string (defaults to today)
  dailyStudyMinutes?: number // Minutes available per day (defaults to 90 = 1.5 hours)
  availability?: Availability // User availability schedule
}

/**
 * Generate a study schedule from study guide content
 */
export function generateSchedule(
  guideId: string,
  userId: string,
  content: string,
  options: ScheduleOptions
): StudySchedule {
  const now = new Date()
  const targetDate = parseISO(options.targetDate)
  const startDate = options.startDate ? parseISO(options.startDate) : startOfDay(now)
  const dailyStudyMinutes = options.dailyStudyMinutes || 90 // Default to 1.5 hours

  // Parse content into study items
  const parsedItems = parseStudyGuideContent(content)
  
  if (parsedItems.length === 0) {
    throw new Error('No study items found in content')
  }

  // Calculate available days
  const daysUntilTarget = differenceInDays(targetDate, startDate)
  
  if (daysUntilTarget <= 0) {
    throw new Error('Target date must be in the future')
  }

  // Distribute items across days
  const scheduledItems = distributeItemsAcrossDays(
    parsedItems,
    startDate,
    daysUntilTarget,
    dailyStudyMinutes,
    options.availability
  )

  const totalEstimatedMinutes = estimateTotalTime(parsedItems)
  const scheduleId = `${guideId}-schedule-${Date.now()}`

  return {
    id: scheduleId,
    guideId,
    userId,
    targetDate: formatISO(targetDate),
    startDate: formatISO(startDate),
    items: scheduledItems,
    totalEstimatedMinutes,
    lastRecalculated: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Distribute study items across available days
 * Ensures no day exceeds the daily study minute limit
 */
function distributeItemsAcrossDays(
  items: ParsedStudyItem[],
  startDate: Date,
  daysAvailable: number,
  dailyStudyMinutes: number,
  availability?: Availability
): StudyItem[] {
  const scheduledItems: StudyItem[] = []
  
  // Create array of available days based on availability schedule
  const availableDays = getAvailableDays(startDate, daysAvailable, availability)
  
  if (availableDays.length === 0) {
    throw new Error('No available days for study schedule')
  }

  // Track minutes used per day
  const dayMinutesUsed = new Map<string, number>()
  availableDays.forEach(day => {
    const dayKey = formatISO(day)
    dayMinutesUsed.set(dayKey, 0)
  })

  let itemIndex = 0
  let currentDayOffset = 0 // Track which day we're currently trying

  // Distribute items across days, ensuring we don't exceed daily limit
  // Strategy: Try to fill days with multiple smaller items before moving to next day
  for (const item of items) {
    let placed = false
    let attempts = 0
    
    // Try to place item starting from current day offset, cycling through all days
    // Prefer days that already have items (to create multiple items per day)
    while (!placed && attempts < availableDays.length * 2) {
      const dayIndex = (currentDayOffset + attempts) % availableDays.length
      const dayDate = availableDays[dayIndex]
      const dayKey = formatISO(dayDate)
      const currentDayMinutes = dayMinutesUsed.get(dayKey) || 0
      const dayMinutesAvailable = getDayMinutesAvailable(dayDate, availability, dailyStudyMinutes)

      // Check if item fits on this day
      if (currentDayMinutes + item.estimatedMinutes <= dayMinutesAvailable) {
        scheduledItems.push({
          id: item.id,
          section: item.section,
          content: item.content,
          estimatedMinutes: item.estimatedMinutes,
          scheduledDate: dayKey,
          completedAt: null,
          order: itemIndex++,
        })
        dayMinutesUsed.set(dayKey, currentDayMinutes + item.estimatedMinutes)
        placed = true
        
        // Prefer to continue on same day if there's still space (for multiple items per day)
        // Only move to next day if current day is getting full (>70% capacity)
        const dayCapacityUsed = currentDayMinutes + item.estimatedMinutes
        const dayCapacityPercent = dayCapacityUsed / dayMinutesAvailable
        
        if (dayCapacityPercent < 0.7 && attempts < availableDays.length) {
          // Stay on same day for next item
          currentDayOffset = dayIndex
        } else {
          // Move to next day
          currentDayOffset = (dayIndex + 1) % availableDays.length
        }
      }
      attempts++
    }

    // If item couldn't be placed (too large for any single day), place on day with most space
    if (!placed) {
      // Find day with most available space
      let bestDay = availableDays[0]
      let mostSpace = -1
      for (const dayDate of availableDays) {
        const dayKey = formatISO(dayDate)
        const currentDayMinutes = dayMinutesUsed.get(dayKey) || 0
        const dayMinutesAvailable = getDayMinutesAvailable(dayDate, availability, dailyStudyMinutes)
        const availableSpace = dayMinutesAvailable - currentDayMinutes
        if (availableSpace > mostSpace) {
          mostSpace = availableSpace
          bestDay = dayDate
        }
      }
      
      const bestDayKey = formatISO(bestDay)
      scheduledItems.push({
        id: item.id,
        section: item.section,
        content: item.content,
        estimatedMinutes: item.estimatedMinutes,
        scheduledDate: bestDayKey,
        completedAt: null,
        order: itemIndex++,
      })
      const currentMinutes = dayMinutesUsed.get(bestDayKey) || 0
      dayMinutesUsed.set(bestDayKey, currentMinutes + item.estimatedMinutes)
      // Move to next day
      const bestDayIndex = availableDays.indexOf(bestDay)
      currentDayOffset = (bestDayIndex + 1) % availableDays.length
    }
  }

  return scheduledItems
}

/**
 * Get array of available days based on availability schedule
 */
function getAvailableDays(
  startDate: Date,
  daysAvailable: number,
  availability?: Availability
): Date[] {
  const days: Date[] = []
  const now = startOfDay(startDate)

  for (let i = 0; i < daysAvailable; i++) {
    const date = addDays(now, i)
    const dayOfWeek = date.getDay()

    // If availability is specified, check if day is available
    if (availability) {
      const weeklySchedule = availability.weekly[dayOfWeek.toString()]
      if (weeklySchedule && weeklySchedule.length > 0) {
        days.push(date)
      }
    } else {
      // Default: all days are available
      days.push(date)
    }
  }

  return days
}

/**
 * Get available minutes for a specific day
 */
function getDayMinutesAvailable(
  date: Date,
  availability: Availability | undefined,
  defaultMinutes: number
): number {
  if (!availability) {
    return defaultMinutes
  }

  const dayOfWeek = date.getDay()
  const weeklySchedule = availability.weekly[dayOfWeek.toString()]

  if (!weeklySchedule || weeklySchedule.length === 0) {
    return 0
  }

  // Calculate total available minutes from time blocks
  let totalMinutes = 0
  for (const block of weeklySchedule) {
    const [startH, startM] = block.start.split(':').map(Number)
    const [endH, endM] = block.end.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    totalMinutes += endMinutes - startMinutes
  }

  // Subtract buffer time
  const bufferMinutes = availability.bufferMinutes || 0
  const sessionLength = availability.sessionLengthMinutes || 60
  
  // Calculate how many sessions fit
  const sessions = Math.floor(totalMinutes / (sessionLength + bufferMinutes))
  return sessions * sessionLength
}

/**
 * Recalculate schedule based on completed items and days passed
 */
export function recalculateSchedule(
  schedule: StudySchedule,
  availability?: Availability,
  dailyStudyMinutes?: number
): StudySchedule {
  const now = new Date()
  const targetDate = parseISO(schedule.targetDate)
  const startDate = parseISO(schedule.startDate)

  // Filter out completed items
  const incompleteItems = schedule.items.filter(item => !item.completedAt)

  // Filter out items scheduled for past days
  const futureItems = incompleteItems.filter(item => {
    const scheduledDate = parseISO(item.scheduledDate)
    return isAfter(scheduledDate, startOfDay(now)) || scheduledDate.getTime() === startOfDay(now).getTime()
  })

  // Recalculate days available
  const daysUntilTarget = Math.max(1, differenceInDays(targetDate, now))

  // Redistribute remaining items
  const redistributedItems = redistributeRemainingItems(
    futureItems,
    now,
    daysUntilTarget,
    dailyStudyMinutes || 90, // Default to 1.5 hours
    availability
  )

  // Keep completed items with their original dates
  const completedItems = schedule.items.filter(item => item.completedAt)

  return {
    ...schedule,
    items: [...completedItems, ...redistributedItems],
    lastRecalculated: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Redistribute remaining items across available days
 * Ensures no day exceeds the daily study minute limit
 */
function redistributeRemainingItems(
  items: StudyItem[],
  startDate: Date,
  daysAvailable: number,
  dailyStudyMinutes: number,
  availability?: Availability
): StudyItem[] {
  const availableDays = getAvailableDays(startDate, daysAvailable, availability)
  
  if (availableDays.length === 0) {
    return items // Return items unchanged if no available days
  }

  const redistributed: StudyItem[] = []
  
  // Track minutes used per day
  const dayMinutesUsed = new Map<string, number>()
  availableDays.forEach(day => {
    const dayKey = formatISO(day)
    dayMinutesUsed.set(dayKey, 0)
  })

  let currentDayOffset = 0 // Track which day we're currently trying

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    let placed = false
    let attempts = 0

    // Try to place item starting from current day offset, cycling through all days
    // Prefer days that already have items (to create multiple items per day)
    while (!placed && attempts < availableDays.length * 2) {
      const dayIndex = (currentDayOffset + attempts) % availableDays.length
      const dayDate = availableDays[dayIndex]
      const dayKey = formatISO(dayDate)
      const currentDayMinutes = dayMinutesUsed.get(dayKey) || 0
      const dayMinutesAvailable = getDayMinutesAvailable(dayDate, availability, dailyStudyMinutes)

      // Check if item fits on this day
      if (currentDayMinutes + item.estimatedMinutes <= dayMinutesAvailable) {
        redistributed.push({
          ...item,
          scheduledDate: dayKey,
          order: i,
        })
        dayMinutesUsed.set(dayKey, currentDayMinutes + item.estimatedMinutes)
        placed = true
        
        // Prefer to continue on same day if there's still space (for multiple items per day)
        // Only move to next day if current day is getting full (>70% capacity)
        const dayCapacityUsed = currentDayMinutes + item.estimatedMinutes
        const dayCapacityPercent = dayCapacityUsed / dayMinutesAvailable
        
        if (dayCapacityPercent < 0.7 && attempts < availableDays.length) {
          // Stay on same day for next item
          currentDayOffset = dayIndex
        } else {
          // Move to next day
          currentDayOffset = (dayIndex + 1) % availableDays.length
        }
      }
      attempts++
    }

    // If item couldn't be placed, find day with most available space
    if (!placed) {
      let bestDay = availableDays[0]
      let mostSpace = -1
      for (const dayDate of availableDays) {
        const dayKey = formatISO(dayDate)
        const currentDayMinutes = dayMinutesUsed.get(dayKey) || 0
        const dayMinutesAvailable = getDayMinutesAvailable(dayDate, availability, dailyStudyMinutes)
        const availableSpace = dayMinutesAvailable - currentDayMinutes
        if (availableSpace > mostSpace) {
          mostSpace = availableSpace
          bestDay = dayDate
        }
      }
      
      const bestDayKey = formatISO(bestDay)
      redistributed.push({
        ...item,
        scheduledDate: bestDayKey,
        order: i,
      })
      const currentMinutes = dayMinutesUsed.get(bestDayKey) || 0
      dayMinutesUsed.set(bestDayKey, currentMinutes + item.estimatedMinutes)
      // Move to next day
      const bestDayIndex = availableDays.indexOf(bestDay)
      currentDayOffset = (bestDayIndex + 1) % availableDays.length
    }
  }

  return redistributed
}


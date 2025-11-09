import { z } from 'zod'

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueAt: z.string().nullable(),
  estimatedMinutes: z.number().positive(),
  priority: z.enum(['low', 'normal', 'high']),
  status: z.enum(['todo', 'doing', 'done']),
  source: z.string().optional(),
  courseId: z.string().optional(),
  courseName: z.string().optional(),
  type: z.string().optional(),
  url: z.string().nullable().optional(),
})

export const SessionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(['planned', 'in_progress', 'done', 'skipped']),
})

export const AvailabilitySchema = z.object({
  timezone: z.string(),
  weekly: z.record(
    z.string(),
    z.array(z.object({
      start: z.string(),
      end: z.string(),
    }))
  ),
  blocks: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).optional(),
  sessionLengthMinutes: z.number().positive(),
  bufferMinutes: z.number().nonnegative(),
})

export const UserProfileSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  availability: AvailabilitySchema.optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    notifications: z.boolean().optional(),
    selectedCourseIds: z.array(z.string()).optional(),
    focusSessionLength: z.number().optional(),
    breakLength: z.number().optional(),
    soundPreference: z.enum(['none', 'white-noise', 'nature']).optional(),
    showMotivationalMessages: z.boolean().optional(),
  }).optional(),
})

export const StudyGuideSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  pdfPath: z.string(),
  pdfUrl: z.string(),
  openaiFileId: z.string(),
  associationType: z.enum(['course', 'task', 'general']),
  associationId: z.string().optional(),
  associationName: z.string().optional(),
  aiContent: z.string(),
  aiGeneratedAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(['uploading', 'processing', 'ready', 'error']),
})

export const NotificationPreferencesSchema = z.object({
  inApp: z.boolean(),
  browserPush: z.boolean(),
  email: z.boolean(),
  sessionReminders: z.boolean(),
  deadlineAlerts: z.boolean(),
  studyPlanUpdates: z.boolean(),
  reminderTiming: z.number(), // minutes before
})

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['session-reminder', 'deadline-alert', 'study-plan-update']),
  title: z.string(),
  message: z.string(),
  link: z.string().optional(),
  read: z.boolean(),
  createdAt: z.number(),
})

export type Task = z.infer<typeof TaskSchema>
export type Session = z.infer<typeof SessionSchema>
export type Availability = z.infer<typeof AvailabilitySchema>
export type UserProfile = z.infer<typeof UserProfileSchema>
export type StudyGuide = z.infer<typeof StudyGuideSchema>
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>
export type Notification = z.infer<typeof NotificationSchema>

export type CanvasCourse = {
  id: number
  name: string
  course_code?: string
}

export type CanvasAssignment = {
  id: number
  name: string
  due_at: string | null
  points_possible: number | null
  html_url: string
}

export type CanvasModule = {
  id: number
  name: string
}


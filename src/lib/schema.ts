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
  description: z.string().nullable().optional(),
  pdfPath: z.string().nullable().optional(), // Single PDF for backward compatibility
  pdfUrl: z.string().nullable().optional(),
  pdfPaths: z.array(z.string()).optional(), // Multiple PDFs
  pdfUrls: z.array(z.string()).optional(),
  openaiFileId: z.string().nullable().optional(), // Single file ID for backward compatibility
  openaiFileIds: z.array(z.string()).optional(), // Multiple file IDs
  associationType: z.enum(['course', 'task', 'general']),
  associationId: z.string().nullable().optional(),
  associationName: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
  assignmentContext: z.array(z.object({
    name: z.string(),
    dueAt: z.string().nullable(),
    pointsPossible: z.number(),
  })).optional(),
  canvasMaterialsContext: z.object({
    modules: z.array(z.object({
      name: z.string(),
      position: z.number(),
      items: z.array(z.object({
        title: z.string(),
        type: z.string(),
      })),
    })),
    syllabus: z.string().nullable(),
    totalModules: z.number(),
    totalModuleItems: z.number(),
  }).optional(),
  scheduleId: z.string().optional(),
  targetDate: z.string().optional(), // ISO date string for test/assignment due date
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
export type StudyItem = z.infer<typeof StudyItemSchema>
export type StudySchedule = z.infer<typeof StudyScheduleSchema>
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

export const StudyItemSchema = z.object({
  id: z.string(),
  section: z.string(),
  content: z.string(),
  estimatedMinutes: z.number().positive(),
  scheduledDate: z.string(), // ISO date string
  completedAt: z.number().nullable(),
  order: z.number().nonnegative(),
})

export const StudyScheduleSchema = z.object({
  id: z.string(),
  guideId: z.string(),
  userId: z.string(),
  targetDate: z.string(), // ISO date string
  startDate: z.string(), // ISO date string
  items: z.array(StudyItemSchema),
  totalEstimatedMinutes: z.number().nonnegative(),
  lastRecalculated: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})


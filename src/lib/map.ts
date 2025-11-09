/**
 * Centralized LLM prompts for the Study Tool application
 */

export interface StudyPlanPromptData {
  courseMapSize: number
  tasksLength: number
  urgentTasksLength: number
  coursesSummary: Array<{
    courseName: string
    totalTasks: number
    breakdown: {
      exams: number
      quizzes: number
      assignments: number
      discussions: number
    }
    upcomingDeadlines: Array<{
      title: string
      type: string
      dueAt: string
      estimatedMinutes: number
    }>
  }>
}

/**
 * System message for the AI study plan generation
 */
export const STUDY_PLAN_SYSTEM_MESSAGE = `You are an expert academic coach who specializes in helping college students with ADHD create effective study plans. You provide specific, actionable advice tailored to their coursework and mindful of ADHD-related challenges (procrastination, focus difficulties, anxiety).`

/**
 * Generates the user prompt for AI study plan generation
 */
export function generateStudyPlanPrompt(data: StudyPlanPromptData): string {
  const { courseMapSize, tasksLength, urgentTasksLength, coursesSummary } = data

  return `**Student Profile:**

- ADHD (struggles with procrastination & focus, not on medication)
- Tends to feel anxious before exams/deadlines
- Prefers hands-on and visual learning methods

**Student's Current Workload:**

- Total courses: ${courseMapSize}
- Total tasks: ${tasksLength}
- Urgent tasks (due < 7 days): ${urgentTasksLength}

**Course Breakdown:**

${coursesSummary.map(course => `
### ${course.courseName}
- Total tasks: ${course.totalTasks}
- Exams: ${course.breakdown.exams}
- Quizzes: ${course.breakdown.quizzes}
- Assignments: ${course.breakdown.assignments}
- Discussions: ${course.breakdown.discussions}

**Upcoming Deadlines:**
${course.upcomingDeadlines.map(task => `- ${task.title} (${task.type}) - Due: ${new Date(task.dueAt).toLocaleDateString()} - Est. ${task.estimatedMinutes} minutes`).join('\n')}
`).join('\n')}

Please provide:

1. **Overall Study Strategy** (2-3 sentences)
   - High-level approach considering their workload and deadlines
   - Tailored to ADHD challenges and learning preferences

2. **Priority Focus Areas** (3-5 bullet points)
   - Which courses/tasks need immediate attention
   - Rationale for prioritization
   - Consider anxiety triggers and procrastination risks

3. **Weekly Study Recommendations** (specific advice)
   - Suggested study time allocation per course
   - Best practices for managing this specific workload
   - Incorporate hands-on and visual learning strategies

4. **Exam Preparation Tips** (if applicable)
   - Specific strategies for upcoming exams
   - Timeline recommendations
   - Anxiety management techniques

5. **Time Management & Focus Tips** (2-3 actionable tips)
   - ADHD-specific strategies for maintaining focus
   - Techniques to combat procrastination
   - Break down overwhelming tasks into manageable chunks
   - Visual and hands-on study methods

Keep the advice concise, actionable, in markdown.`
}


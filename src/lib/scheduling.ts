import { addMinutes, differenceInMinutes, isBefore, formatISO, parseISO } from 'date-fns'

export type Task = {
  id: string
  title: string
  dueAt: string | null
  estimatedMinutes: number
  priority: 'low' | 'normal' | 'high'
  status: 'todo' | 'doing' | 'done'
}

export type Availability = {
  timezone: string
  weekly: Record<number, Array<{ start: string; end: string }>>
  blocks?: Array<{ start: string; end: string }>
  sessionLengthMinutes: number
  bufferMinutes: number
}

export type Session = {
  id: string
  taskId: string
  startsAt: string
  endsAt: string
  status: 'planned' | 'in_progress' | 'done' | 'skipped'
}

function sortTasks(tasks: Task[]) {
  return tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      const ad = a.dueAt ? parseISO(a.dueAt).getTime() : Infinity
      const bd = b.dueAt ? parseISO(b.dueAt).getTime() : Infinity
      if (ad !== bd) return ad - bd
      const p = { high: 0, normal: 1, low: 2 }
      return p[a.priority] - p[b.priority]
    })
}

function* generateSlots(av: Availability, days = 21) {
  const now = new Date()
  for (let d = 0; d < days; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d)
    const dow = date.getDay()
    const day = av.weekly[dow] || []
    for (const w of day) {
      const [sh, sm] = w.start.split(':').map(Number)
      const [eh, em] = w.end.split(':').map(Number)
      let cur = new Date(date); cur.setHours(sh, sm, 0, 0)
      const end = new Date(date); end.setHours(eh, em, 0, 0)
      while (isBefore(addMinutes(cur, av.sessionLengthMinutes), addMinutes(end, 1))) {
        const starts = new Date(cur)
        const ends = addMinutes(starts, av.sessionLengthMinutes)
        yield { starts, ends }
        cur = addMinutes(ends, av.bufferMinutes)
      }
    }
  }
}

export function planSessions(tasks: Task[], av: Availability): Session[] {
  const sorted = sortTasks(tasks)
  const result: Session[] = []
  const slots = generateSlots(av)
  for (const t of sorted) {
    let remaining = t.estimatedMinutes
    while (remaining > 0) {
      const slot = slots.next()
      if (slot.done) break
      const id = `${t.id}-${result.length}`
      result.push({
        id,
        taskId: t.id,
        startsAt: formatISO(slot.value.starts),
        endsAt: formatISO(slot.value.ends),
        status: 'planned'
      })
      remaining -= differenceInMinutes(slot.value.ends, slot.value.starts)
    }
  }
  return result
}

export function adjustPlan(existingSessions: Session[], tasks: Task[], av: Availability) {
  const undone = existingSessions.filter(s => s.status !== 'done' && isBefore(new Date(), parseISO(s.endsAt)))
  const planned = planSessions(tasks, av)
  return [...existingSessions.filter(s => s.status === 'done'), ...planned]
}


'use client'

import { db } from '@/lib/firebase/client'
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import type { Session } from '@/lib/schema'

type Task = {
  id: string
  title: string
  type?: string
  courseName?: string
}

export default function StudyPlanBoard({ uid }: { uid: string }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'users', uid, 'plans', 'active', 'sessions'),
      orderBy('startsAt')
    )
    return onSnapshot(q, async (snap) => {
      const sessionData = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Session))
      setSessions(sessionData)

      // Fetch task details for each unique taskId
      const taskIds = [...new Set(sessionData.map(s => s.taskId))]
      const taskData: Record<string, Task> = {}
      
      await Promise.all(
        taskIds.map(async (taskId) => {
          try {
            const taskSnap = await getDoc(doc(db, 'users', uid, 'plans', 'active', 'tasks', taskId))
            if (taskSnap.exists()) {
              taskData[taskId] = { id: taskId, ...(taskSnap.data() as any) } as Task
            } else {
              taskData[taskId] = { id: taskId, title: taskId, type: 'unknown' }
            }
          } catch (err) {
            taskData[taskId] = { id: taskId, title: taskId, type: 'unknown' }
          }
        })
      )
      
      setTasks(taskData)
      setLoading(false)
    })
  }, [uid])

  if (loading) {
    return <div className="text-sm text-gray-600 dark:text-gray-400">Loading sessions...</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        No sessions scheduled. Sync Canvas and recompute your plan to get started.
      </div>
    )
  }

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'exam': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'quiz': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'assignment': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'discussion': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'module': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const task = tasks[s.taskId]
        return (
          <Link
            key={s.id}
            href={`/session/${s.id}`}
            className="block rounded-lg border border-gray-950/10 p-3 hover:bg-gray-950/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {format(new Date(s.startsAt), 'EEE, MMM d p')} → {format(new Date(s.endsAt), 'p')}
              </div>
              {task?.type && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(task.type)}`}>
                  {task.type}
                </span>
              )}
            </div>
            <div className="mt-1 font-medium text-gray-950 dark:text-white">
              {task?.title || s.taskId}
            </div>
            {task?.courseName && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {task.courseName}
              </div>
            )}
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 capitalize">{s.status}</div>
          </Link>
        )
      })}
    </div>
  )
}


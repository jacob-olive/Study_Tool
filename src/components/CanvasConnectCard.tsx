'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { TextInput } from '@/components/input'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

export default function CanvasConnectCard() {
  const [baseUrl, setBaseUrl] = useState('https://canvas.instructure.com')
  const [pat, setPat] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Check if Canvas is already connected
    const checkStatus = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) return
        
        const res = await fetch('/api/canvas/status', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        const data = await res.json()
        if (data.connected) {
          setConnected(true)
          setBaseUrl(data.baseUrl || 'https://canvas.instructure.com')
        }
      } catch (err) {
        // Ignore errors
      }
    }
    
    // Wait for auth to be ready
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        checkStatus()
      }
    })
    
    return () => unsubscribe()
  }, [])

  const handleSave = async () => {
    if (!baseUrl || !pat) {
      alert('Please enter both Canvas URL and Personal Access Token')
      return
    }
    setSaving(true)
    try {
      // Get Firebase ID token for authentication
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        alert('Please sign in to connect Canvas')
        return
      }

      const res = await fetch('/api/canvas/connect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ baseUrl, pat }),
      })
      const data = await res.json()
      if (res.ok) {
        setConnected(true)
        alert('Canvas connected successfully!')
      } else {
        alert(`Failed to connect: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert('Failed to connect: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      // Get Firebase ID token for authentication
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        alert('Please sign in to sync Canvas')
        return
      }

      // Get selected course IDs from user preferences
      let courseIds: string[] | undefined
      try {
        if (auth.currentUser) {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
          const prefs = userDoc.data()?.preferences
          if (prefs?.selectedCourseIds && Array.isArray(prefs.selectedCourseIds) && prefs.selectedCourseIds.length > 0) {
            courseIds = prefs.selectedCourseIds
          }
        }
      } catch (err) {
        console.error('Error loading course preferences:', err)
      }

      const res = await fetch('/api/canvas/sync', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(courseIds ? { courseIds } : {}),
      })
      const data = await res.json()
      if (res.ok) {
        const taskCount = data.counts?.tasks || 0
        
        if (taskCount === 0) {
          let message = `Sync completed, but no tasks were found.\n\n${data.warning || 'Make sure your Canvas courses have assignments, quizzes, or modules.'}\n\n`
          message += `Courses checked: ${data.counts?.courses || data.coursesChecked || 0}\n`
          
          if (data.debug?.courseNames && data.debug.courseNames.length > 0) {
            message += `\nCourses found:\n${data.debug.courseNames.join('\n')}\n`
          }
          
          if (data.errors && data.errors.length > 0) {
            message += `\nErrors encountered:\n${data.errors.slice(0, 5).join('\n')}`
            if (data.errors.length > 5) {
              message += `\n... and ${data.errors.length - 5} more errors`
            }
          }
          
          alert(message)
          console.error('Canvas sync debug info:', data)
          return
        }
        
        alert(`Sync completed! Imported ${taskCount} tasks.\n\nGenerating AI study plan...`)
        
        // Trigger recompute
        await fetch('/api/plan/recompute', { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        
        // Generate AI study plan
        const aiRes = await fetch('/api/plan/ai-generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        
        if (aiRes.ok) {
          alert('AI study plan generated! Check the Study Plan page to view your personalized recommendations.')
        } else {
          const aiData = await aiRes.json()
          alert(`Sync successful, but AI plan generation failed: ${aiData.error || 'Unknown error'}`)
        }
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert('Failed to sync: ' + (err as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-4 space-y-4 dark:border-white/10">
      <h2 className="text-lg font-medium text-gray-950 dark:text-white">Connect Canvas</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Enter your Canvas URL and Personal Access Token (PAT)
      </p>
      <div className="space-y-2">
        <TextInput
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="w-full"
          placeholder="https://canvas.instructure.com"
          disabled={connected}
        />
        <TextInput
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          className="w-full"
          placeholder="Your Canvas Personal Access Token"
          disabled={connected}
        />
      </div>
      {connected ? (
        <div className="space-y-2">
          <p className="text-sm text-green-600 dark:text-green-400">✓ Canvas connected</p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving || !baseUrl || !pat}
          className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Connect'}
        </button>
      )}
    </div>
  )
}


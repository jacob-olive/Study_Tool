'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/button'
import { auth } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import type { NotificationPreferences } from '@/lib/schema'

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    inApp: true,
    browserPush: false,
    email: false,
    sessionReminders: true,
    deadlineAlerts: true,
    studyPlanUpdates: false,
    reminderTiming: 15,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushSupported, setPushSupported] = useState(false)

  useEffect(() => {
    const checkPushSupport = () => {
      setPushSupported(
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
      )
    }

    checkPushSupport()
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    const user = auth.currentUser
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/notifications/preferences', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      })

      if (res.ok) {
        const data = await res.json()
        setPrefs(data.preferences)
      }
    } catch (err) {
      console.error('Error loading preferences:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const user = auth.currentUser
    if (!user) {
      setError('Please sign in to save preferences')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prefs),
      })

      if (res.ok) {
        alert('Notification preferences saved!')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save preferences')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const requestPushPermission = async () => {
    if (!pushSupported) {
      alert('Push notifications are not supported in this browser')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setPrefs(prev => ({ ...prev, browserPush: true }))
        alert('Push notifications enabled! Make sure to save your preferences.')
      } else {
        alert('Push notification permission denied')
      }
    } catch (err) {
      console.error('Error requesting push permission:', err)
      alert('Failed to request push notification permission')
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-950/10 p-4 dark:border-white/10">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading preferences...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-950/10 p-6 space-y-6 dark:border-white/10">
      <div>
        <h2 className="text-lg font-medium text-gray-950 dark:text-white">Notification Preferences</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Choose how and when you want to receive notifications
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-950 dark:text-white mb-3">Notification Channels</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.inApp}
                onChange={(e) => setPrefs(prev => ({ ...prev, inApp: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-950 dark:text-white">In-app notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.browserPush}
                onChange={(e) => setPrefs(prev => ({ ...prev, browserPush: e.target.checked }))}
                disabled={!pushSupported}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <span className="text-sm text-gray-950 dark:text-white">Browser push notifications</span>
                {!pushSupported && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Not supported in this browser</p>
                )}
              </div>
              {pushSupported && !prefs.browserPush && (
                <button
                  onClick={requestPushPermission}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Enable
                </button>
              )}
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.email}
                onChange={(e) => setPrefs(prev => ({ ...prev, email: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-950 dark:text-white">Email notifications</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">(Coming soon)</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-950 dark:text-white mb-3">Notification Types</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.sessionReminders}
                onChange={(e) => setPrefs(prev => ({ ...prev, sessionReminders: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-950 dark:text-white">Study session reminders</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.deadlineAlerts}
                onChange={(e) => setPrefs(prev => ({ ...prev, deadlineAlerts: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-950 dark:text-white">Deadline alerts</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.studyPlanUpdates}
                onChange={(e) => setPrefs(prev => ({ ...prev, studyPlanUpdates: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-950 dark:text-white">Study plan updates</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-950 dark:text-white mb-2">
            Reminder Timing
          </label>
          <select
            value={prefs.reminderTiming}
            onChange={(e) => setPrefs(prev => ({ ...prev, reminderTiming: Number(e.target.value) }))}
            className="block w-full rounded-lg bg-white px-3 py-1.5 text-sm text-gray-950 dark:text-white outline -outline-offset-1 outline-gray-950/15 focus:outline-2 focus:outline-blue-500 dark:bg-white/10 dark:outline-white/15"
          >
            <option value="5">5 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  )
}


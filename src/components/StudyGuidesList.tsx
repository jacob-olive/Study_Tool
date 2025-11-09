'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/lib/firebase/client'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore'
import StudyGuideCard from './StudyGuideCard'
import type { StudyGuide } from '@/lib/schema'

export default function StudyGuidesList() {
  const [guides, setGuides] = useState<StudyGuide[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'course' | 'task' | 'general'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false)
        return
      }

      const guidesRef = collection(db, 'users', user.uid, 'study-guides')
      const q = query(guidesRef, orderBy('createdAt', 'desc'))

      const unsubscribeSnapshot = onSnapshot(
        q,
        (snap) => {
          const guidesData = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as StudyGuide))
          setGuides(guidesData)
          setLoading(false)
        },
        (err) => {
          console.error('Error fetching study guides:', err)
          setLoading(false)
        }
      )

      return () => unsubscribeSnapshot()
    })

    return () => unsubscribe()
  }, [])

  const handleDelete = (id: string) => {
    setGuides(prev => prev.filter(g => g.id !== id))
  }

  const handleRegenerate = (id: string) => {
    // The card will update via Firestore listener
    // This is just for immediate UI feedback if needed
  }

  const filteredGuides = guides.filter(guide => {
    if (filterType !== 'all' && guide.associationType !== filterType) {
      return false
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        guide.name.toLowerCase().includes(query) ||
        guide.description?.toLowerCase().includes(query) ||
        guide.associationName?.toLowerCase().includes(query)
      )
    }
    return true
  })

  if (loading) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Loading study guides...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-950 dark:text-white">
          My Study Guides ({guides.length})
        </h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search study guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full sm:w-64 rounded-lg bg-white px-3 py-1.5 text-sm text-gray-950 dark:text-white outline -outline-offset-1 outline-gray-950/15 focus:outline-2 focus:outline-blue-500 dark:bg-white/10 dark:outline-white/15"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="block w-full sm:w-auto rounded-lg bg-white px-3 py-1.5 text-sm text-gray-950 dark:text-white outline -outline-offset-1 outline-gray-950/15 focus:outline-2 focus:outline-blue-500 dark:bg-white/10 dark:outline-white/15"
          >
            <option value="all">All Types</option>
            <option value="general">General</option>
            <option value="course">Course</option>
            <option value="task">Task</option>
          </select>
        </div>
      </div>

      {filteredGuides.length === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          {guides.length === 0 ? (
            <p>No study guides yet. Upload a PDF to get started!</p>
          ) : (
            <p>No study guides match your filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGuides.map(guide => (
            <StudyGuideCard
              key={guide.id}
              guide={guide}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      )}
    </div>
  )
}


import { getApps, initializeApp, cert, App } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

let adminApp: App | null = null

function getAdminApp() {
  if (adminApp) return adminApp
  if (getApps().length) {
    adminApp = getApps()[0]!
    return adminApp
  }
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    // During build time, env vars may not be available - return a mock that will fail at runtime
    throw new Error('Firebase Admin SDK credentials not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.')
  }
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  })
  return adminApp
}

// Lazy getters that only initialize when accessed
export const adminAuth = new Proxy({} as ReturnType<typeof getAdminAuth>, {
  get(_target, prop) {
    return getAdminAuth(getAdminApp())[prop as keyof ReturnType<typeof getAdminAuth>]
  }
})

export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop) {
    return getFirestore(getAdminApp())[prop as keyof ReturnType<typeof getFirestore>]
  }
})

export const adminStorage = new Proxy({} as ReturnType<typeof getStorage>, {
  get(_target, prop) {
    return getStorage(getAdminApp())[prop as keyof ReturnType<typeof getStorage>]
  }
})


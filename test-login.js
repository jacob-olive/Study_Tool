// Test script to verify Firebase Auth is working
// Run this in browser console on localhost:3000/login

async function testLogin() {
  const { auth } = await import('/src/lib/firebase/client.ts')
  const { createUserWithEmailAndPassword } = await import('firebase/auth')
  
  try {
    const cred = await createUserWithEmailAndPassword(
      auth, 
      'test@example.com', 
      'testpassword123'
    )
    console.log('Test user created:', cred.user.email)
    return cred
  } catch (err) {
    console.error('Test login error:', err)
    throw err
  }
}

// To test: testLogin()


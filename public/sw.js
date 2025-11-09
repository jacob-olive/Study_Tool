// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title || 'StudyFlow Notification'
  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    data: data.data || {},
    tag: data.tag || 'studyflow-notification',
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})


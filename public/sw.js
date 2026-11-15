// Jay's Food Court - Service Worker for PWA Notifications & Offline Shell
const CACHE_NAME = 'jfc-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: "Jay's Food Court",
    body: 'You have a new update regarding your delivery.',
    icon: '/favicon.ico',
    tag: 'jfc-notification'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'jfc-comm',
    data: data.data || {},
    vibrate: [200, 100, 200],
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click to focus or open corresponding order page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Firebase Cloud Messaging Service Worker
// This runs in the background to receive push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase config - hardcoded for service worker reliability
const firebaseConfig = {
  apiKey: "AIzaSyCc2XoohyKS-xz1mAiqj1Bjxc7to-Jk1aU",
  authDomain: "route-dd9a4.firebaseapp.com",
  projectId: "route-dd9a4",
  storageBucket: "route-dd9a4.firebasestorage.app",
  messagingSenderId: "294923677205",
  appId: "1:294923677205:web:e4be69951a62436de9e81c"
};

// Initialize Firebase immediately
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Route.ng';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Also handle push events directly (for iOS compatibility)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  if (event.data) {
    const payload = event.data.json();
    console.log('Push payload:', payload);

    const notificationTitle = payload.notification?.title || 'Route.ng';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.data?.tag || 'default',
      data: payload.data
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open or focus the app
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if app is already open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Open new window if not already open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

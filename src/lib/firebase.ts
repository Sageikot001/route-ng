import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Firebase configuration - these will come from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  const configured = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId
  );
  console.log('[Firebase] Config check:', {
    configured,
    hasApiKey: Boolean(firebaseConfig.apiKey),
    hasProjectId: Boolean(firebaseConfig.projectId),
    hasSenderId: Boolean(firebaseConfig.messagingSenderId),
  });
  return configured;
}

// Initialize Firebase (only once)
let app = getApps().length === 0 ? null : getApps()[0];

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured. Push notifications disabled.');
    return null;
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

// Get Firebase Messaging instance
export async function getFirebaseMessaging() {
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging not supported in this browser');
    return null;
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  return getMessaging(firebaseApp);
}

// Register service worker and get FCM token
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return null;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered:', registration);

    // Send Firebase config to service worker
    if (registration.active) {
      registration.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig,
      });
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Get messaging instance
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    // Get FCM token
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VAPID key not configured');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
}

// Listen for foreground messages
export async function onForegroundMessage(callback: (payload: { notification?: { title?: string; body?: string } }) => void) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
}

export { firebaseConfig };

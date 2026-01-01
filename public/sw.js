// Service Worker for Hacker News Watcher
//
// Note: This worker runs in the service worker global scope (self).
// It cannot directly import ES modules or access the CONFIG object from config.js.
// Instead, we use hardcoded defaults here, or configuration can be passed via
// postMessage() from the client or stored in IndexedDB/localStorage.

// Get configuration (fallback to defaults if not available)
function getHNApiBase() {
  try {
    const stored = self.localStorage?.getItem?.('hn-api-base');
    if (stored) return stored;
  } catch {
    // localStorage may not be available in SW context
  }
  return 'https://hacker-news.firebaseio.com';
}

// Install event - register periodic sync if available
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(self.skipWaiting());
});

// Activate event - claim clients and attempt periodic sync registration
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Register periodic sync if available
      if ('periodicSync' in self.registration) {
        try {
          await self.registration.periodicSync.register('hn-hourly', {
            minInterval: 60 * 60 * 1000, // 1 hour
          });
          console.log('[SW] Periodic sync registered');
        } catch (error) {
          console.warn('[SW] Periodic sync registration failed:', error);
        }
      }
    })(),
  );
});

// Push event - receive and display notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  if (!event.data) {
    console.warn('[SW] Push event with no data');
    return;
  }

  let notificationData = {};
  try {
    notificationData = event.data.json();
  } catch (error) {
    console.warn('[SW] Failed to parse push data:', error);
    notificationData = {
      title: 'Hacker News Update',
      body: event.data.text(),
    };
  }

  const title = notificationData.title || 'Hacker News Update';
  const options = {
    body: notificationData.body || '',
    icon: notificationData.icon || '/manifest.json',
    badge: '/manifest.json',
    tag: 'hn-notification',
    requireInteraction: false,
    data: {
      url: notificationData.url || 'https://news.ycombinator.com',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event - open URL
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data.url || 'https://news.ycombinator.com';

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Check if URL is already open in a window
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window if URL not already open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })(),
  );
});

// Periodic sync event - fetch HN API and show notifications
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'hn-hourly') {
    console.log('[SW] Periodic sync triggered for hn-hourly');
    event.waitUntil(fetchAndNotify());
  }
});

// Fetch new HN stories and show notification
async function fetchAndNotify() {
  try {
    const hnApiBase = getHNApiBase();

    // Fetch latest stories
    const response = await fetch(`${hnApiBase}/v0/newstories.json`);
    if (!response.ok) throw new Error(`HN API error: ${response.status}`);

    const storyIds = await response.json();
    const topStoryId = storyIds[0];

    // Fetch story details
    const storyResponse = await fetch(`${hnApiBase}/v0/item/${topStoryId}.json`);
    if (!storyResponse.ok) throw new Error(`HN item API error: ${storyResponse.status}`);

    const story = await storyResponse.json();

    // Check if story is within last hour
    const oneHourAgo = Math.floor(Date.now() / 1000) - 60 * 60;
    if (story.time < oneHourAgo) {
      console.log('[SW] Top story is older than 1 hour, skipping notification');
      return;
    }

    // Show notification
    const title = story.title || 'New HN Story';
    const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;

    await self.registration.showNotification(title, {
      body: `by ${story.by || 'unknown'} • ${story.score || 0} points`,
      icon: '/manifest.json',
      badge: '/manifest.json',
      tag: 'hn-notification',
      data: {
        url,
        timestamp: Date.now(),
      },
    });

    console.log('[SW] Notification shown for story:', title);
  } catch (error) {
    console.error('[SW] Fetch and notify error:', error);
  }
}

// Message handler for manual sync requests from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MANUAL_SYNC') {
    console.log('[SW] Manual sync requested');
    event.waitUntil(fetchAndNotify());
  }
});

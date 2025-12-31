import { CONFIG, isVapidKeyConfigured, validateVapidKey } from './config.js';

// State management
let swRegistration = null;
let subscription = null;

// DOM elements
const statusEl = document.getElementById('status');
const subscribeBtnEl = document.getElementById('subscribe-btn');
const unsubscribeBtnEl = document.getElementById('unsubscribe-btn');

// Initialize on page load
window.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    // Check VAPID key configuration
    if (!isVapidKeyConfigured()) {
      console.warn('VAPID key not configured. Notifications will not work until key is set.');
      subscribeBtnEl.title = 'VAPID key not configured. Contact administrator.';
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register('sw.js', {
        scope: '/',
      });
      setStatus('Service worker registered ✓', 'pending');
    } else {
      throw new Error('Service Workers not supported');
    }

    // Check existing subscription
    const existingSubscription = await swRegistration.pushManager.getSubscription();
    if (existingSubscription) {
      subscription = existingSubscription;
      updateUI();
      setStatus('Already subscribed ✓', 'subscribed');
    } else {
      enableSubscribeButton();
      setStatus('Ready to subscribe', 'pending');
    }
  } catch (error) {
    console.error('Init error:', error);
    setStatus(`Error: ${error.message}`, 'error');
  }
}

subscribeBtnEl.addEventListener('click', subscribe);
unsubscribeBtnEl.addEventListener('click', unsubscribe);

async function subscribe() {
  try {
    if (!isVapidKeyConfigured()) {
      throw new Error('VAPID key not configured. Notifications cannot be enabled.');
    }

    setStatus('Requesting notification permission...', 'pending');

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    setStatus('Subscribing to push notifications...', 'pending');

    // Subscribe to push notifications
    const options = {
      ...CONFIG.notificationDefaults,
      applicationServerKey: urlBase64ToUint8Array(CONFIG.vapidPublicKey),
    };

    subscription = await swRegistration.pushManager.subscribe(options);
    console.log('Push subscription created:', subscription.endpoint);

    // Send subscription to backend
    setStatus('Registering with server...', 'pending');
    const response = await fetch(`${CONFIG.backendUrl}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      // If backend fails, clean up the push subscription
      await subscription.unsubscribe();
      subscription = null;
      throw new Error(`Server registration failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Server registration successful:', result.id);

    // Save to localStorage
    localStorage.setItem('hn-subscription', JSON.stringify(subscription.toJSON()));

    updateUI();
    setStatus('Successfully subscribed ✓', 'subscribed');
  } catch (error) {
    console.error('Subscription error:', error);
    setStatus(`Error: ${error.message}`, 'error');
  }
}

async function unsubscribe() {
  try {
    setStatus('Unsubscribing...', 'pending');

    if (subscription) {
      // Notify backend to clean up subscription
      try {
        await fetch(`${CONFIG.backendUrl}/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription.toJSON()),
        });
        console.log('Backend unsubscription successful');
      } catch (error) {
        console.warn('Backend unsubscription failed, continuing:', error);
        // Continue even if backend fails - we'll unsubscribe locally
      }

      // Unsubscribe from push manager
      await subscription.unsubscribe();
      subscription = null;
      console.log('Local push unsubscription completed');
    }

    // Clear localStorage
    localStorage.removeItem('hn-subscription');

    updateUI();
    setStatus('Unsubscribed ✓', 'pending');
    enableSubscribeButton();
  } catch (error) {
    console.error('Unsubscribe error:', error);
    setStatus(`Error: ${error.message}`, 'error');
  }
}

function updateUI() {
  if (subscription) {
    subscribeBtnEl.disabled = true;
    unsubscribeBtnEl.disabled = false;
  } else {
    subscribeBtnEl.disabled = false;
    unsubscribeBtnEl.disabled = true;
  }
}

function enableSubscribeButton() {
  subscribeBtnEl.disabled = false;
  unsubscribeBtnEl.disabled = true;
}

function setStatus(message, state) {
  statusEl.textContent = message;
  statusEl.className = `status ${state}`;
}

// Utility: Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

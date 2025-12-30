// TODO: Replace with actual VAPID public key from Firebase config
const VAPID_PUBLIC_KEY = 'REPLACE_ME_WITH_VAPID_PUBLIC_KEY';

// TODO: Replace with actual backend URL
const BACKEND_URL = 'http://localhost:5001/hnwatch-default/us-central1/api';

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
    // Register service worker
    if ('serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.register('sw.js', {
        scope: '/',
      });
      setStatus('Service worker registered', 'pending');
    } else {
      throw new Error('Service Workers not supported');
    }

    // Check existing subscription
    const existingSubscription = await swRegistration.pushManager.getSubscription();
    if (existingSubscription) {
      subscription = existingSubscription;
      updateUI();
      setStatus('Already subscribed', 'subscribed');
    } else {
      enableSubscribeButton();
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
    setStatus('Requesting notification permission...', 'pending');

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    setStatus('Subscribing to push...', 'pending');

    // Subscribe to push notifications
    const options = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    };

    subscription = await swRegistration.pushManager.subscribe(options);

    // Send subscription to backend
    setStatus('Sending subscription to server...', 'pending');
    const response = await fetch(`${BACKEND_URL}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription.toJSON()),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    // Save to localStorage
    localStorage.setItem('hn-subscription', JSON.stringify(subscription.toJSON()));

    updateUI();
    setStatus('Successfully subscribed!', 'subscribed');
  } catch (error) {
    console.error('Subscription error:', error);
    setStatus(`Error: ${error.message}`, 'error');
  }
}

async function unsubscribe() {
  try {
    setStatus('Unsubscribing...', 'pending');

    if (subscription) {
      // Notify backend
      await fetch(`${BACKEND_URL}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      // Unsubscribe from push
      await subscription.unsubscribe();
      subscription = null;
    }

    // Clear localStorage
    localStorage.removeItem('hn-subscription');

    updateUI();
    setStatus('Unsubscribed', 'pending');
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

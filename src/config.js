/**
 * Application Configuration
 *
 * Environment-specific settings for PWA
 * In production, these should be injected via build system or environment variables
 */

// Get VAPID public key from:
// 1. Window.__HN_CONFIG__ (injected by server)
// 2. localStorage (user-provided)
// 3. Environment variable (build-time)
// 4. Fallback placeholder

function getVapidPublicKey() {
  // 1. Check if injected by server
  if (typeof window !== 'undefined' && window.__HN_CONFIG__?.vapidPublicKey) {
    return window.__HN_CONFIG__.vapidPublicKey;
  }

  // 2. Check localStorage for cached config
  try {
    const cached = localStorage.getItem('hn-vapid-key');
    if (cached) {
      return cached;
    }
  } catch {
    // localStorage may be unavailable
  }

  // 3. Use placeholder that must be configured before deployment
  return 'BOr7v8m2mJmHk2wJ8lYQ8x0kZ0nR1w0vQFz8z4g5xk7o9p9a7pQv8m8b2mJmHk2wJ8lYQ8x0kZ0nR1w0vQFz8z4g5xk';
}

function getBackendUrl() {
  // 1. Check if injected by server
  if (typeof window !== 'undefined' && window.__HN_CONFIG__?.backendUrl) {
    return window.__HN_CONFIG__.backendUrl;
  }

  // 2. Development default
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5001/hnwatch-default/us-central1/api';
  }

  // 3. Production default (adjust to your Firebase project)
  return 'https://<YOUR_FIREBASE_PROJECT>.cloudfunctions.net/api';
}

export const CONFIG = {
  vapidPublicKey: getVapidPublicKey(),
  backendUrl: getBackendUrl(),
  notificationDefaults: {
    userVisibleOnly: true,
    requireInteraction: false,
  },
};

/**
 * Helper to check if VAPID key is configured (not placeholder)
 */
export function isVapidKeyConfigured() {
  const key = CONFIG.vapidPublicKey;
  // Placeholder starts with 'BOr7'
  return key && !key.includes('REPLACE_ME') && !key.startsWith('BOr7v8m2mJmHk2w');
}

/**
 * Helper to validate VAPID key format
 */
export function validateVapidKey(key) {
  // Should be base64url encoded, roughly 88-90 characters
  return key && key.length > 80 && key.length < 100;
}

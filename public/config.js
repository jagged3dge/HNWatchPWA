/**
 * Application Configuration
 *
 * Environment-specific settings for PWA
 * Variables are injected at build time via Vite and environment variables
 *
 * Configuration priority (highest to lowest):
 * 1. Window.__HN_CONFIG__ (injected by server at runtime)
 * 2. Build-time environment variables (Vite injects)
 * 3. localStorage (user-provided fallback)
 * 4. Hardcoded fallbacks
 */

// Build-time injected values from environment variables
// These are replaced by Vite during build with actual values
const BUILD_VAPID_PUBLIC_KEY =
  typeof __VITE_VAPID_PUBLIC_KEY__ !== 'undefined' ? __VITE_VAPID_PUBLIC_KEY__ : '';
const BUILD_BACKEND_URL = typeof __VITE_BACKEND_URL__ !== 'undefined' ? __VITE_BACKEND_URL__ : '';
const BUILD_HN_API_BASE = typeof __VITE_HN_API_BASE__ !== 'undefined' ? __VITE_HN_API_BASE__ : '';
const BUILD_ENVIRONMENT =
  typeof __VITE_ENVIRONMENT__ !== 'undefined' ? __VITE_ENVIRONMENT__ : 'development';

function getVapidPublicKey() {
  // 1. Check if injected by server at runtime
  if (typeof window !== 'undefined' && window.__HN_CONFIG__?.vapidPublicKey) {
    return window.__HN_CONFIG__.vapidPublicKey;
  }

  // 2. Use build-time environment variable
  if (BUILD_VAPID_PUBLIC_KEY) {
    return BUILD_VAPID_PUBLIC_KEY;
  }

  // 3. Check localStorage for user-provided value
  try {
    const cached = localStorage.getItem('hn-vapid-key');
    if (cached) {
      return cached;
    }
  } catch {
    // localStorage may be unavailable
  }

  // 4. Fallback placeholder (requires manual configuration)
  return '';
}

function getBackendUrl() {
  // 1. Check if injected by server at runtime
  if (typeof window !== 'undefined' && window.__HN_CONFIG__?.backendUrl) {
    return window.__HN_CONFIG__.backendUrl;
  }

  // 2. Use build-time environment variable
  if (BUILD_BACKEND_URL) {
    return BUILD_BACKEND_URL;
  }

  // 3. Fallback placeholder
  return 'http://localhost:5001/hnwatch-default/us-central1/api';
}

function getHnApiBase() {
  // 1. Check if injected by server at runtime
  if (typeof window !== 'undefined' && window.__HN_CONFIG__?.hnApiBase) {
    return window.__HN_CONFIG__.hnApiBase;
  }

  // 2. Use build-time environment variable
  if (BUILD_HN_API_BASE) {
    return BUILD_HN_API_BASE;
  }

  // 3. Fallback to official HN API
  return 'https://hacker-news.firebaseio.com';
}

export const CONFIG = {
  vapidPublicKey: getVapidPublicKey(),
  backendUrl: getBackendUrl(),
  hnApiBase: getHnApiBase(),
  environment: BUILD_ENVIRONMENT,
  notificationDefaults: {
    userVisibleOnly: true,
    requireInteraction: false,
  },
};

/**
 * Helper to check if VAPID key is configured (not empty)
 */
export function isVapidKeyConfigured() {
  const key = CONFIG.vapidPublicKey;
  return key && key.length > 10 && !key.includes('REPLACE');
}

/**
 * Helper to validate VAPID key format
 * Should be base64url encoded, roughly 88-90 characters
 */
export function validateVapidKey(key) {
  return key && key.length > 80 && key.length < 100;
}

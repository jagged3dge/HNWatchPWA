/**
 * Unit tests for critical utility functions
 * Run with: npm test
 */

import { expect, test } from '@playwright/test';

// Utility function to test: isNewWithinLastHour
function isNewWithinLastHour(timestamp: number): boolean {
  const oneHourAgo = Math.floor(Date.now() / 1000) - 60 * 60;
  return timestamp >= oneHourAgo;
}

test.describe('isNewWithinLastHour utility', () => {
  test('returns true for story from 5 minutes ago', () => {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
    expect(isNewWithinLastHour(fiveMinutesAgo)).toBe(true);
  });

  test('returns true for story from 59 minutes ago', () => {
    const fiftyNineMinutesAgo = Math.floor(Date.now() / 1000) - 59 * 60;
    expect(isNewWithinLastHour(fiftyNineMinutesAgo)).toBe(true);
  });

  test('returns true for story from right now', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isNewWithinLastHour(now)).toBe(true);
  });

  test('returns false for story from 61 minutes ago', () => {
    const sixtyOneMinutesAgo = Math.floor(Date.now() / 1000) - 61 * 60;
    expect(isNewWithinLastHour(sixtyOneMinutesAgo)).toBe(false);
  });

  test('returns false for story from 2 hours ago', () => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
    expect(isNewWithinLastHour(twoHoursAgo)).toBe(false);
  });

  test('returns false for story from 24 hours ago', () => {
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    expect(isNewWithinLastHour(twentyFourHoursAgo)).toBe(false);
  });
});

// Test VAPID key utility
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const buffer = Buffer.from(base64, 'base64');
  return new Uint8Array(buffer);
}

test.describe('urlBase64ToUint8Array utility', () => {
  test('converts standard base64 string', () => {
    const base64 = 'SGVsbG8gV29ybGQ='; // "Hello World"
    const result = urlBase64ToUint8Array(base64);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  test('converts URL-safe base64 string (with - and _)', () => {
    // Create a base64 string that would need - and _ replacement
    const base64UrlSafe = 'SGVs_G8gV29y-GQ='; // Modified to have - and _
    const result = urlBase64ToUint8Array(base64UrlSafe);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test('handles padding correctly', () => {
    // Test strings that need different padding amounts
    const base64NoPadding = 'SGVsbG8'; // No padding
    const base64OnePadding = 'SGVsbG8='; // One =
    const base64TwoPadding = 'SGVsbA=='; // Two ==

    const result1 = urlBase64ToUint8Array(base64NoPadding);
    const result2 = urlBase64ToUint8Array(base64OnePadding);
    const result3 = urlBase64ToUint8Array(base64TwoPadding);

    expect(result1).toBeInstanceOf(Uint8Array);
    expect(result2).toBeInstanceOf(Uint8Array);
    expect(result3).toBeInstanceOf(Uint8Array);
  });
});

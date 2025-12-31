import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { expect, test } from '@playwright/test';

type ListenerMap = Record<string, (event: unknown) => unknown>;

type FetchResponse<T = unknown> = {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
};

type FetchImpl = (url: string) => Promise<FetchResponse>;

type WindowClient = {
  url?: string;
  focus?: () => Promise<void>;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function defer(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function loadServiceWorkerScript(overrides?: {
  matchAll?: () => Promise<WindowClient[]>;
  openWindow?: (url: string) => Promise<unknown>;
  periodicSyncRegister?: (tag: string, options: { minInterval: number }) => Promise<void>;
  fetchImpl?: FetchImpl;
  nowMs?: number;
}) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const swPath = path.join(__dirname, '..', '..', 'public', 'sw.js');
  const swCode = fs.readFileSync(swPath, 'utf8');

  const listeners: ListenerMap = {};

  const showNotificationCalls: Array<{ title: string; options: unknown }> = [];

  const clientsMatchAll = overrides?.matchAll ?? (async () => []);
  const clientsOpenWindow = overrides?.openWindow ?? (async () => undefined);

  const periodicSyncRegister = overrides?.periodicSyncRegister;

  const claimCalls: number[] = [];

  const selfObj: Record<string, unknown> = {
    registration: {
      showNotification: async (title: string, options: unknown) => {
        showNotificationCalls.push({ title, options });
      },
      periodicSync: periodicSyncRegister
        ? {
            register: periodicSyncRegister,
          }
        : undefined,
    },
    clients: {
      claim: async () => {
        claimCalls.push(Date.now());
      },
    },
    skipWaiting: async () => undefined,
    addEventListener: (type: string, handler: (event: unknown) => unknown) => {
      listeners[type] = handler;
    },
  };

  const clientsObj: Record<string, unknown> = {
    matchAll: clientsMatchAll,
    openWindow: clientsOpenWindow,
  };

  const fetchImpl =
    overrides?.fetchImpl ??
    (async () => ({
      ok: true,
      status: 200,
      json: async () => [],
    }));

  const RealDate = Date;
  const DateImpl =
    typeof overrides?.nowMs === 'number'
      ? class MockDate extends RealDate {
          static now() {
            return overrides.nowMs as number;
          }
        }
      : RealDate;

  const context = vm.createContext({
    self: selfObj,
    clients: clientsObj,
    fetch: fetchImpl,
    Date: DateImpl,
    console,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(swCode, context);

  return {
    listeners,
    self: selfObj,
    clients: clientsObj,
    showNotificationCalls,
    claimCalls,
  };
}

test.describe('Service worker script', () => {
  test('push event shows a notification with title and url', async () => {
    const { listeners, showNotificationCalls } = loadServiceWorkerScript();

    expect(listeners.push).toBeDefined();

    const done = defer();

    const event = {
      data: {
        json: () => ({
          title: 'Test story',
          body: 'by test',
          url: 'https://example.com/story',
        }),
        text: () => 'fallback',
      },
      waitUntil: (p: Promise<unknown>) => {
        p.finally(done.resolve);
      },
    };

    listeners.push(event);
    await done.promise;

    expect(showNotificationCalls.length).toBe(1);
    expect(showNotificationCalls[0]?.title).toBe('Test story');
    expect(showNotificationCalls[0]?.options?.data?.url).toBe('https://example.com/story');
  });

  test('periodicsync shows notification for recent story and skips older story', async () => {
    const nowMs = 1_700_000_000_000;
    const nowSeconds = Math.floor(nowMs / 1000);
    const oneMinuteAgo = nowSeconds - 60;
    const twoHoursAgo = nowSeconds - 2 * 60 * 60;

    // First run: recent story
    {
      const fetchCalls: string[] = [];
      const { listeners, showNotificationCalls } = loadServiceWorkerScript({
        nowMs,
        fetchImpl: async (url) => {
          fetchCalls.push(url);
          if (url.endsWith('/v0/newstories.json')) {
            return { ok: true, status: 200, json: async () => [123] };
          }
          if (url.includes('/v0/item/123.json')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ id: 123, title: 'Recent', by: 'a', time: oneMinuteAgo }),
            };
          }
          return { ok: false, status: 404, json: async () => null };
        },
      });

      const done = defer();
      const event = {
        tag: 'hn-hourly',
        waitUntil: (p: Promise<unknown>) => {
          p.finally(done.resolve);
        },
      };

      listeners.periodicsync(event);
      await done.promise;

      expect(fetchCalls.some((u) => u.includes('/v0/newstories.json'))).toBe(true);
      expect(showNotificationCalls.length).toBe(1);
      expect(showNotificationCalls[0]?.title).toBe('Recent');
    }

    // Second run: older story should not notify
    {
      const { listeners, showNotificationCalls } = loadServiceWorkerScript({
        nowMs,
        fetchImpl: async (url) => {
          if (url.endsWith('/v0/newstories.json')) {
            return { ok: true, status: 200, json: async () => [456] };
          }
          if (url.includes('/v0/item/456.json')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ id: 456, title: 'Old', by: 'b', time: twoHoursAgo }),
            };
          }
          return { ok: false, status: 404, json: async () => null };
        },
      });

      const done = defer();
      const event = {
        tag: 'hn-hourly',
        waitUntil: (p: Promise<unknown>) => {
          p.finally(done.resolve);
        },
      };

      listeners.periodicsync(event);
      await done.promise;

      expect(showNotificationCalls.length).toBe(0);
    }
  });

  test('manual sync message triggers fetch and notification', async () => {
    const nowMs = 1_700_000_000_000;
    const nowSeconds = Math.floor(nowMs / 1000);
    const oneMinuteAgo = nowSeconds - 60;

    const { listeners, showNotificationCalls } = loadServiceWorkerScript({
      nowMs,
      fetchImpl: async (url) => {
        if (url.endsWith('/v0/newstories.json')) {
          return { ok: true, status: 200, json: async () => [999] };
        }
        if (url.includes('/v0/item/999.json')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 999, title: 'Manual', by: 'm', time: oneMinuteAgo }),
          };
        }
        return { ok: false, status: 404, json: async () => null };
      },
    });

    const done = defer();
    const event = {
      data: { type: 'MANUAL_SYNC' },
      waitUntil: (p: Promise<unknown>) => {
        p.finally(done.resolve);
      },
    };

    listeners.message(event);
    await done.promise;

    expect(showNotificationCalls.length).toBe(1);
    expect(showNotificationCalls[0]?.title).toBe('Manual');
  });

  test('periodicsync handles HN API error without notifying', async () => {
    const { listeners, showNotificationCalls } = loadServiceWorkerScript({
      fetchImpl: async (_url) => ({ ok: false, status: 500, json: async () => null }),
    });

    const done = defer();
    const event = {
      tag: 'hn-hourly',
      waitUntil: (p: Promise<unknown>) => {
        p.finally(done.resolve);
      },
    };

    listeners.periodicsync(event);
    await done.promise;

    expect(showNotificationCalls.length).toBe(0);
  });

  test('notificationclick focuses existing window client when url matches', async () => {
    let focused = 0;

    const { listeners } = loadServiceWorkerScript({
      matchAll: async () => [
        {
          url: 'https://example.com/story',
          focus: async () => {
            focused++;
          },
        },
      ],
    });

    expect(listeners.notificationclick).toBeDefined();

    const done = defer();
    const closeCalls: number[] = [];

    const event = {
      notification: {
        data: { url: 'https://example.com/story' },
        close: () => closeCalls.push(Date.now()),
      },
      waitUntil: (p: Promise<unknown>) => {
        p.finally(done.resolve);
      },
    };

    listeners.notificationclick(event);
    await done.promise;

    expect(closeCalls.length).toBe(1);
    expect(focused).toBe(1);
  });

  test('activate registers periodic sync when available', async () => {
    const registerCalls: Array<{ tag: string; minInterval: number }> = [];

    const { listeners, claimCalls } = loadServiceWorkerScript({
      periodicSyncRegister: async (tag, options) => {
        registerCalls.push({ tag, minInterval: options.minInterval });
      },
    });

    expect(listeners.activate).toBeDefined();

    const done = defer();
    const event = {
      waitUntil: (p: Promise<unknown>) => {
        p.finally(done.resolve);
      },
    };

    listeners.activate(event);
    await done.promise;

    expect(claimCalls.length).toBeGreaterThan(0);
    expect(registerCalls).toEqual([{ tag: 'hn-hourly', minInterval: 60 * 60 * 1000 }]);
  });
});

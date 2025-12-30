import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

type ListenerMap = Record<string, (event: any) => any>;

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
  matchAll?: () => Promise<any[]>;
  openWindow?: (url: string) => Promise<any>;
  periodicSyncRegister?: (tag: string, options: { minInterval: number }) => Promise<void>;
  fetchImpl?: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
}) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const swPath = path.join(__dirname, '..', '..', 'public', 'sw.js');
  const swCode = fs.readFileSync(swPath, 'utf8');

  const listeners: ListenerMap = {};

  const showNotificationCalls: Array<{ title: string; options: any }> = [];

  const clientsMatchAll = overrides?.matchAll ?? (async () => []);
  const clientsOpenWindow = overrides?.openWindow ?? (async () => undefined);

  const periodicSyncRegister = overrides?.periodicSyncRegister;

  const claimCalls: number[] = [];

  const selfObj: any = {
    registration: {
      showNotification: async (title: string, options: any) => {
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
    addEventListener: (type: string, handler: (event: any) => any) => {
      listeners[type] = handler;
    },
  };

  const clientsObj: any = {
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

  const context = vm.createContext({
    self: selfObj,
    clients: clientsObj,
    fetch: fetchImpl,
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
      waitUntil: (p: Promise<any>) => {
        p.finally(done.resolve);
      },
    };

    listeners.push(event);
    await done.promise;

    expect(showNotificationCalls.length).toBe(1);
    expect(showNotificationCalls[0]?.title).toBe('Test story');
    expect(showNotificationCalls[0]?.options?.data?.url).toBe('https://example.com/story');
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
      waitUntil: (p: Promise<any>) => {
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
      waitUntil: (p: Promise<any>) => {
        p.finally(done.resolve);
      },
    };

    listeners.activate(event);
    await done.promise;

    expect(claimCalls.length).toBeGreaterThan(0);
    expect(registerCalls).toEqual([{ tag: 'hn-hourly', minInterval: 60 * 60 * 1000 }]);
  });
});

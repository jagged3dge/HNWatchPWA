/**
 * Firebase Cloud Functions for HN Watcher PWA
 *
 * Responsibilities:
 * - POST /api/subscribe: store push subscriptions
 * - POST /api/unsubscribe: remove push subscriptions
 * - Scheduled hourly: fetch HN API, filter recent stories, send push notifications
 */

import crypto from 'node:crypto';
import express from 'express';
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush from 'web-push';

import { type HnItem, hnItemToUrl, isNewWithinLastHour } from './utils.js';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// TODO: Configure VAPID keys via Firebase Functions config
// firebase functions:config:set vapid.public="..." vapid.private="..."
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'REPLACE_ME';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'REPLACE_ME';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@example.com', // contact email
  vapidPublicKey,
  vapidPrivateKey,
);

// ============ REST Endpoints ============

function cors(req: express.Request, res: express.Response): boolean {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }

  return false;
}

function subscriptionIdFromEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex');
}

type PushSubscriptionJson = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

const apiApp = express();
apiApp.use(express.json({ limit: '100kb' }));

apiApp.options('/subscribe', (req, res) => {
  cors(req, res);
  res.status(204).send('');
});

apiApp.options('/unsubscribe', (req, res) => {
  cors(req, res);
  res.status(204).send('');
});

/**
 * POST /api/subscribe - Store a new push subscription
 */
apiApp.post('/subscribe', async (req, res) => {
  cors(req, res);

  try {
    const subscription = req.body as PushSubscriptionJson;

    // Validate subscription object
    if (!subscription?.endpoint) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }

    const subscriptionId = subscriptionIdFromEndpoint(subscription.endpoint);
    await db.collection('subscriptions').doc(subscriptionId).set({
      subscription,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastVerified: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Subscription stored: ${subscriptionId}`);
    res.status(200).json({ success: true, id: subscriptionId });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to store subscription' });
  }
});

/**
 * POST /api/unsubscribe - Remove a push subscription
 */
apiApp.post('/unsubscribe', async (req, res) => {
  cors(req, res);

  try {
    const subscription = req.body as PushSubscriptionJson;

    // Find and delete subscription
    if (!subscription?.endpoint) {
      res.status(400).json({ error: 'Invalid subscription object' });
      return;
    }

    const subscriptionId = subscriptionIdFromEndpoint(subscription.endpoint);
    await db.collection('subscriptions').doc(subscriptionId).delete();

    console.log(`Subscription removed: ${subscriptionId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

export const api = onRequest({ region: 'us-central1' }, apiApp);

// ============ Scheduled Functions ============

/**
 * Scheduled Cloud Function - runs every hour
 * Fetches new HN stories and sends push notifications
 */
export const sendHourlyNotifications = onSchedule(
  { region: 'us-central1', schedule: 'every 60 minutes' },
  async (_event) => {
    try {
      console.log('Starting hourly notification job at', new Date().toISOString());

      // Fetch HN newstories
      const stories = await fetchRecentHNStories();
      if (stories.length === 0) {
        console.log('No recent stories found');
        return;
      }

      // Get all active subscriptions
      const subscriptions = await getAllSubscriptions();
      console.log(`Found ${subscriptions.length} active subscriptions`);

      if (subscriptions.length === 0) {
        console.log('No subscriptions to notify');
        return;
      }

      // Send push to each subscription
      let successCount = 0;
      let failureCount = 0;

      for (const subDoc of subscriptions) {
        const subscription = subDoc.data().subscription;

        for (const story of stories) {
          try {
            const payload = JSON.stringify({
              title: story.title,
              body: `by ${story.by || 'unknown'} • ${story.score || 0} points`,
              url: hnItemToUrl(story),
              icon: 'https://news.ycombinator.com/y18.gif',
            });

            await webpush.sendNotification(subscription, payload);
            successCount++;
          } catch (error) {
            console.warn(`Failed to send to subscription:`, error);
            failureCount++;

            // Clean up invalid subscriptions
            const maybeStatus = (error as { statusCode?: number } | null)?.statusCode;
            if (maybeStatus === 404 || maybeStatus === 410) {
              const subId = subscriptionIdFromEndpoint(subscription.endpoint);
              await db.collection('subscriptions').doc(subId).delete();
              console.log(`Removed invalid subscription: ${subId}`);
            }
          }
        }
      }

      console.log(`Notification job complete: ${successCount} sent, ${failureCount} failed`);
    } catch (error) {
      console.error('Hourly notification job failed:', error);
      // Don't throw - let the job finish gracefully
    }
  },
);

// ============ Helper Functions ============

/**
 * Fetch recent HN stories from last hour
 */
async function fetchRecentHNStories() {
  try {
    // Fetch newstories list
    const listResponse = await fetch('https://hacker-news.firebaseio.com/v0/newstories.json');
    if (!listResponse.ok) throw new Error(`HN API error: ${listResponse.status}`);

    const storyIds = (await listResponse.json()) as number[];
    const recentStories: HnItem[] = [];

    // Check the first 30 stories for ones within the last hour
    for (let i = 0; i < Math.min(30, storyIds.length); i++) {
      const storyId = storyIds[i];
      const itemResponse = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`,
      );

      if (!itemResponse.ok) continue;

      const story = (await itemResponse.json()) as HnItem;

      if (story.time && isNewWithinLastHour(story.time)) {
        recentStories.push(story);
      } else if (story.time && !isNewWithinLastHour(story.time)) {
        // Stop checking older stories
        break;
      }
    }

    return recentStories;
  } catch (error) {
    console.error('Failed to fetch HN stories:', error);
    return [];
  }
}

/**
 * Get all active subscriptions from Firestore
 */
async function getAllSubscriptions() {
  try {
    const snapshot = await db.collection('subscriptions').get();
    return snapshot.docs;
  } catch (error) {
    console.error('Failed to fetch subscriptions:', error);
    return [];
  }
}

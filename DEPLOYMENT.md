# HN Watcher PWA — Deployment Guide

This guide covers preparing and deploying the Hacker News Watcher PWA to production.

## Prerequisites

- Firebase project created at https://console.firebase.google.com
- Firebase CLI installed: `npm install -g firebase-tools`
- Node.js 18+ installed
- VAPID key pair generated

---

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for sending Web Push notifications.

```bash
# Install web-push globally if not already installed
npm install -g web-push

# Generate VAPID key pair
web-push generate-vapid-keys
```

This will output:
```
Public Key: <BASE64_PUBLIC_KEY>
Private Key: <BASE64_PRIVATE_KEY>
```

**Save both keys securely.** The public key is embedded in the frontend, the private key is only used by the backend.

---

## Step 2: Initialize Firebase Project

If you haven't already:

```bash
firebase login
firebase init

# Select:
# - Hosting (for static PWA)
# - Functions (for Cloud Functions)
# - Firestore (for subscription storage)
```

This creates `firebase.json` with your project settings.

---

## Step 3: Configure VAPID Keys in Firebase

### Option A: Using Functions Config (Development/Small Scale)

```bash
firebase functions:config:set vapid.public="<PUBLIC_KEY>" vapid.private="<PRIVATE_KEY>"
```

View current config:
```bash
firebase functions:config:get
```

### Option B: Using Secret Manager (Production/Recommended)

```bash
# Create secrets
gcloud secrets create hn-watcher-vapid-public --data-file=- <<< "<PUBLIC_KEY>"
gcloud secrets create hn-watcher-vapid-private --data-file=- <<< "<PRIVATE_KEY>"

# Grant Cloud Functions permission
gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member=serviceAccount:<PROJECT_ID>@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

Then update `functions/src/index.ts`:
```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretClient = new SecretManagerServiceClient();

async function getVapidKeys() {
  const [publicSecret] = await secretClient.accessSecretVersion({
    name: 'projects/YOUR_PROJECT_ID/secrets/hn-watcher-vapid-public/versions/latest',
  });
  const [privateSecret] = await secretClient.accessSecretVersion({
    name: 'projects/YOUR_PROJECT_ID/secrets/hn-watcher-vapid-private/versions/latest',
  });
  return {
    public: publicSecret.payload.data.toString(),
    private: privateSecret.payload.data.toString(),
  };
}
```

---

## Step 4: Configure Frontend VAPID Key

The public VAPID key must be available to the frontend. Choose one approach:

### Option A: Inject via HTML (Recommended)

Create `public/config.html` or update `index.html`:
```html
<script>
  window.__HN_CONFIG__ = {
    vapidPublicKey: '<PUBLIC_KEY>',
    backendUrl: 'https://<YOUR_PROJECT>.cloudfunctions.net/api'
  };
</script>
```

The app will use `window.__HN_CONFIG__` if available (see `src/config.js`).

### Option B: Use Environment Variables at Build Time

Create `.env.production`:
```
VITE_VAPID_PUBLIC_KEY=<PUBLIC_KEY>
VITE_BACKEND_URL=https://<YOUR_PROJECT>.cloudfunctions.net/api
```

Update `src/config.js` to use `import.meta.env.VITE_*`.

### Option C: Manual Configuration

Users can set the VAPID key at runtime via localStorage:
```javascript
localStorage.setItem('hn-vapid-key', '<PUBLIC_KEY>');
```

---

## Step 5: Deploy Backend (Cloud Functions)

```bash
# Build TypeScript
cd functions
npm run build

# Deploy
cd ..
firebase deploy --only functions

# View logs
firebase functions:log
```

Verify endpoints are working:
```bash
# Test subscribe endpoint
curl -X POST https://<YOUR_PROJECT>.cloudfunctions.net/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://example.com/push",
    "expirationTime": null,
    "keys": {"p256dh": "test", "auth": "test"}
  }'
```

---

## Step 6: Deploy Frontend (Hosting)

```bash
# Build (static - no build step needed, we serve directly from public/)
firebase deploy --only hosting

# View deployment
firebase open hosting:site
```

The app is now live at: `https://<YOUR_PROJECT>.web.app`

---

## Step 7: Create Cloud Scheduler Job (for Hourly Notifications)

The scheduled function `sendHourlyNotifications` is triggered hourly by Cloud Scheduler.

Verify in Google Cloud Console:
1. Go to Cloud Scheduler: https://console.cloud.google.com/cloudscheduler
2. Verify job `sendHourlyNotifications` exists
3. If not, create manually:

```bash
gcloud scheduler jobs create app-engine sendHourlyNotifications \
  --schedule "0 * * * *" \
  --time-zone "UTC" \
  --http-method POST \
  --uri "https://<YOUR_PROJECT>.cloudfunctions.net/sendHourlyNotifications"
```

---

## Step 8: Manual Device Testing (Firefox for Android)

### Setup

1. Install Firefox for Android on your device
2. Navigate to `https://<YOUR_PROJECT>.web.app`
3. Click the "Subscribe" button
4. Grant notification permission
5. Wait for hourly notification (or manually trigger via backend)

### Verify Notifications Received

1. Check device notification center
2. Tap notification to open story URL
3. Check browser console for debug logs

### Troubleshooting

If notifications don't arrive:

1. **Check subscription stored**:
   ```bash
   firebase firestore:browse
   # Check 'subscriptions' collection
   ```

2. **Check scheduled job logs**:
   ```bash
   firebase functions:log --only sendHourlyNotifications
   ```

3. **Manually trigger job**:
   ```bash
   curl -X POST \
     https://<YOUR_PROJECT>.cloudfunctions.net/sendHourlyNotifications \
     -H "Authorization: Bearer $(gcloud auth print-identity-token)"
   ```

4. **Check Web Push status**:
   - Look for 410 Gone errors (invalid/expired subscriptions)
   - These subscriptions are automatically cleaned up

---

## Step 9: Monitoring & Logging

### View Function Logs

```bash
firebase functions:log --only sendHourlyNotifications
firebase functions:log --only api
```

### Set Up Error Reporting

In Google Cloud Console:
1. Enable Error Reporting: https://console.cloud.google.com/errors
2. Errors from Cloud Functions are automatically logged

### Monitor Subscription Count

Add to `functions/src/index.ts`:
```typescript
export const getSubscriptionStats = onRequest(async (req, res) => {
  const snapshot = await db.collection('subscriptions').get();
  res.json({ count: snapshot.docs.length });
});
```

---

## Step 10: Rollback Procedures

### Disable Notifications (Emergency)

1. Disable Cloud Scheduler job:
   ```bash
   gcloud scheduler jobs pause sendHourlyNotifications
   ```

2. Or remove all subscriptions:
   ```bash
   firebase firestore:bulk-delete subscriptions --confirm
   ```

### Revert Firebase Deployment

```bash
firebase hosting:channel:list
firebase hosting:clone <SOURCE_CHANNEL> production  # Revert to previous
```

---

## Periodic Key Rotation

Rotate VAPID keys every 6-12 months:

1. Generate new VAPID key pair
2. Update backend with new private key
3. Update frontend with new public key
4. Old subscriptions will continue working (they include the endpoint URL)

---

## Security Checklist

- [ ] VAPID keys stored securely (not in git)
- [ ] CORS headers configured correctly (only allow your domain)
- [ ] Firestore database rules restrict subscription access
- [ ] Cloud Scheduler job requires authentication
- [ ] HTTPS enforced (automatic with Firebase Hosting)
- [ ] API endpoints validate subscription data
- [ ] Invalid subscriptions cleaned up automatically

---

## Performance Optimization

### Caching

Add caching headers to static assets:
```json
// firebase.json
{
  "hosting": {
    "headers": [
      {
        "source": "/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=3600"
          }
        ]
      },
      {
        "source": "/sw.js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=0, no-cache"
          }
        ]
      }
    ]
  }
}
```

### Database Indexing

For faster subscription queries, add Firestore indexes:
```bash
# This is automatic for most queries, but check:
firebase firestore:indexes
```

---

## Troubleshooting Common Issues

### "VAPID key not configured" error

**Problem**: User sees message that VAPID key is not configured.

**Solution**:
1. Check frontend config in browser DevTools:
   ```javascript
   console.log(window.__HN_CONFIG__)
   ```
2. Verify `src/config.js` is loading
3. Inject VAPID key via `window.__HN_CONFIG__` or update HTML

### Notifications not being sent

**Problem**: Subscriptions stored but no notifications received.

**Solution**:
1. Check Cloud Functions logs
2. Verify VAPID keys match in frontend and backend
3. Check HN API is accessible
4. Verify Firestore subscriptions collection has data

### "410 Gone" errors

**Problem**: Backend receives 410 status when sending push.

**Solution**:
- This is normal - subscriptions expire after browser clears data
- Backend automatically removes these subscriptions
- No action needed - users can re-subscribe

---

## Next Steps

- Monitor error logs and subscriptions
- Gather user feedback on notification frequency
- Consider implementing analytics
- Plan for scaling (high subscription counts)
- Review security periodically

---

For questions or issues, check the [README.md](./README.md) and [SETUP.md](./SETUP.md).

# HN Watcher PWA — Setup & Configuration Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Firebase project (free tier supported)
- Firebase CLI (`npm i -g firebase-tools`)

## Initial Setup

### 1. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Generate VAPID Keys

Web Push requires VAPID (Voluntary Application Server Identification) keys to sign push messages.

```bash
npm install -g web-push
web-push generate-vapid-keys
```

This outputs:
```
Public Key: <your-public-key>
Private Key: <your-private-key>
```

Keep these secure. The private key should never be committed to version control.

### 3. Configure Firebase Project

```bash
# Initialize Firebase in the project directory
firebase init

# Select:
# - Hosting (for static PWA)
# - Functions (for backend)
# - Firestore Database (for subscriptions)
```

#### Set VAPID Keys in Cloud Functions

```bash
firebase functions:config:set \
  vapid.public="<your-public-key>" \
  vapid.private="<your-private-key>"

# Verify configuration
firebase functions:config:get
```

### 4. Configure Frontend with VAPID Public Key

Edit `src/app.js` and replace:
```javascript
const VAPID_PUBLIC_KEY = 'REPLACE_ME_WITH_VAPID_PUBLIC_KEY';
```

With your actual public VAPID key.

Also update the backend URL if deploying to Firebase:
```javascript
const BACKEND_URL = 'https://your-project.cloudfunctions.net/api';
```

Or for local development:
```javascript
const BACKEND_URL = 'http://localhost:5001/your-project/us-central1/api';
```

### 5. Set Up Service Worker in Hosting

Ensure `public/sw.js` is served with correct headers. Add to `firebase.json`:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "sw.js",
        "headers": [
          {
            "key": "Service-Worker-Allowed",
            "value": "/"
          }
        ]
      }
    ]
  }
}
```

## Development Workflow

### Local Testing

#### Terminal 1: Firebase Emulators
```bash
firebase emulators:start
```

This starts:
- Hosting on `http://localhost:5000`
- Functions on `http://localhost:5001`
- Firestore on `http://localhost:8080`

#### Terminal 2: Dev Server (Static Files)
```bash
npx http-server ./public -p 8000
```

Then visit `http://localhost:8000` in your browser.

### Running Tests

```bash
# Headless mode (CI-like)
npm test

# Headed mode (for notification tests)
HEADED=true npm test

# Watch mode
npm test -- --watch

# Specific test file
npm test test/e2d/subscribe.spec.ts
```

### Linting & Formatting

```bash
# Check code quality
npm run lint

# Auto-fix issues
npm run format
```

### Biome Pre-Commit Hook

To set up automatic formatting before commits:

```bash
npm install -D husky
npx husky install
npx husky add .husky/pre-commit "npx biome check --apply"
```

## Deployment

### Deploy to Firebase (Staging/Develop)

```bash
firebase deploy --only hosting,functions
```

Or target specific:
```bash
firebase deploy --only hosting
firebase deploy --only functions
```

### View Logs

```bash
# Streaming logs
firebase functions:log --limit=50

# View in Firebase Console
# https://console.firebase.google.com/project/your-project/functions/logs
```

## Firestore Security Rules

By default, Firestore is open. For production, add rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /subscriptions/{document=**} {
      allow create: if true;  // Allow public subscription creation
      allow delete: if true;  // Allow self-unsubscribe
      allow read, update: if false;  // Internal only
    }
  }
}
```

Deploy with:
```bash
firebase deploy --only firestore:rules
```

## Monitoring & Maintenance

### Check Subscription Count

```bash
firebase firestore:delete subscriptions --recursive
```

Or in Firebase Console → Firestore → subscriptions collection.

### Monitor Push Delivery

View error logs in Firebase Console → Functions → Logs.

Look for:
- `410 Gone` errors (expired subscriptions) — automatically cleaned up
- Network timeouts (HN API issues) — logged but don't repeat
- Quota exceeded — batching may be needed

### Update VAPID Keys (Rotation)

1. Generate new VAPID keys: `web-push generate-vapid-keys`
2. Update Cloud Functions config with new keys
3. Update frontend with new public key
4. Deploy both
5. Old subscriptions will continue working (keys are per-server, not per-subscription)

## Troubleshooting

### "VAPID keys not configured"
- Ensure `firebase functions:config:get vapid` shows your keys
- Check `functions/.runtimeconfig.json` (local) or Cloud Functions config (deployed)

### Service Worker not registering
- Check browser DevTools → Application → Service Workers
- Ensure `public/sw.js` is accessible at `/sw.js`
- Check browser console for CORS or permission errors

### Push notifications not received
- Verify subscription was posted to `/api/subscribe` (check Firestore)
- Check Cloud Functions logs for delivery errors
- On Firefox, ensure notifications permission is granted
- Test with: `curl -X POST http://localhost:5001/PROJECT/us-central1/api/subscribe -d '{...}'`

### Tests timing out
- Ensure web server is running: `npx http-server ./public -p 8000`
- Check Playwright config `webServer.url` matches actual port
- Increase timeout: `npm test -- --timeout=30000`

## Git-Flow Branches

```
main (production, always deployable)
  ↑
release/v0.1.0 (staging)
  ↑
develop (integration branch)
  ↑
feature/feature-name (feature branches)
```

Creating a feature:
```bash
git checkout -b feature/my-feature develop
# Make changes
git add . && git commit -m "feat: my feature"
git push origin feature/my-feature
# Create PR to develop
```

## Security Checklist

- [ ] VAPID keys are never committed to version control
- [ ] Firebase security rules restrict unauthorized access
- [ ] HTTPS is enforced in production (Firebase Hosting does this automatically)
- [ ] Push subscriptions are treated as PII and optionally encrypted
- [ ] Rate limiting is in place for HN API polling
- [ ] CORS headers are restrictive in production (set `Access-Control-Allow-Origin` appropriately)

## Further Reading

- [Web Push Protocol (RFC 8030)](https://datatracker.ietf.org/doc/html/rfc8030)
- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Hacker News API](https://github.com/HackerNews/API)
- [Biome Documentation](https://biomejs.dev)
- [Playwright Testing](https://playwright.dev/docs/intro)

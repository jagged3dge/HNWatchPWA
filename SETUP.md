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

### 4. Configure Environment Variables

The application uses **Vite for build-time environment variable injection**. Configuration priority:

1. **Runtime injection** (`window.__HN_CONFIG__` from server)
2. **Build-time environment variables** (Vite injects via `define`)
3. **localStorage fallback** (user-provided or cached)
4. **Hardcoded defaults**

#### Development Setup

Copy `.env.development.example` to `.env.development.local`:

```bash
cp .env.development.example .env.development.local
```

Edit `.env.development.local` and fill in your VAPID public key:

```env
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VITE_BACKEND_URL=http://localhost:5001/hnwatch-default/us-central1/api
VITE_HN_API_BASE=https://hacker-news.firebaseio.com

# Backend config (never commit real keys to version control)
VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
```

#### Production Setup

Copy `.env.production.example` to `.env.production.local`:

```bash
cp .env.production.example .env.production.local
```

Edit and set production values:

```env
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VITE_BACKEND_URL=https://your-project.cloudfunctions.net/api
VITE_HN_API_BASE=https://hacker-news.firebaseio.com
```

**Important**: Sensitive values (VAPID_PRIVATE_KEY, etc.) should be set via Firebase Functions config in production, not in `.env` files.

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

#### Terminal 2: Dev Server (Vite)
```bash
npm run dev
```

This starts the Vite dev server on `http://localhost:8000` with:
- Hot module replacement (HMR) for fast refresh
- Environment variable injection from `.env.development.local`
- Service worker support
- Automatic browser opening

The dev server watches `src/` and `public/` directories for changes.

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
npx husky
```

## Build & Deployment

### Building for Production

```bash
npm run build
```

This creates an optimized production build in `dist/` with:
- Minified JavaScript
- Environment variables injected from `.env.production.local`
- Source maps (if `NODE_ENV=development`)
- Hashed asset filenames for cache busting

### Preview Production Build Locally

```bash
npm run preview
```

This starts a server serving the `dist/` directory on `http://localhost:4173`.

### Deploy to Firebase (Staging/Develop)

```bash
firebase deploy --only hosting,functions
```

Or target specific:
```bash
firebase deploy --only hosting
firebase deploy --only functions
```

**Before deploying**, ensure:
1. `.env.production.local` exists with correct production values
2. `npm run build` succeeds locally
3. All tests pass: `npm test`

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

### "VAPID key not configured" error in frontend

- Check that `.env.development.local` exists and has `VITE_VAPID_PUBLIC_KEY` set
- Verify `npm run build` injects the key: check `dist/assets/main-*.js` for the key string
- For tests, ensure Vite provides a default test key (set in `vite.config.ts`)

### "VAPID keys not configured" in Cloud Functions

- Ensure `firebase functions:config:get vapid` shows your keys
- Check `functions/.runtimeconfig.json` (local) or Cloud Functions config (deployed)
- Set via: `firebase functions:config:set vapid.public="KEY" vapid.private="KEY"`

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

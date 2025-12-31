# HN Watcher PWA — Quick Reference Card

## Local Development (One-Minute Setup)

```bash
# Install dependencies
npm install && cd functions && npm install && cd ..

# Terminal 1: Start web server
npx http-server ./public -p 8000

# Terminal 2: Run tests
npm test

# Terminal 3: Build & watch backend
cd functions && npm run build
```

## Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test test/unit/sw.test.ts
npm test test/e2d/subscribe.spec.ts

# Watch mode (frontend only)
npm test -- --watch

# Backend watch
cd functions && npm test:watch
```

## Deployment Quick Steps

```bash
# 1. Generate VAPID keys
web-push generate-vapid-keys

# 2. Store in Firebase config
firebase functions:config:set vapid.public="KEY" vapid.private="KEY"

# 3. Inject into frontend (add to public/index.html)
<script>
  window.__HN_CONFIG__ = {
    vapidPublicKey: 'YOUR_KEY_HERE',
    backendUrl: 'https://YOUR_PROJECT.cloudfunctions.net/api'
  };
</script>

# 4. Deploy
firebase deploy

# 5. Verify
curl -X POST https://YOUR_PROJECT.cloudfunctions.net/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "test", "keys": {}}'
```

## Key Files

| File | Purpose |
|------|---------|
| `public/index.html` | PWA entry point |
| `src/app.js` | Frontend subscription logic |
| `src/config.js` | Configuration system |
| `public/sw.js` | Service worker (push + sync) |
| `functions/src/index.ts` | Cloud Functions (API + scheduler) |
| `functions/src/utils.ts` | Retry logic, utilities |
| `test/unit/sw.test.ts` | Service worker tests |
| `functions/test/utils.test.ts` | Backend utility tests |
| `test/e2d/subscribe.spec.ts` | E2E subscription tests |

## Firebase Commands

```bash
# Start emulator (local testing)
firebase emulators:start

# Deploy everything
firebase deploy

# Deploy only backend
firebase deploy --only functions

# Deploy only frontend
firebase deploy --only hosting

# View logs
firebase functions:log

# Configure environment
firebase functions:config:get
firebase functions:config:set vapid.public="KEY"
```

## Configuration

### VAPID Key Sources (in priority order)

1. **`window.__HN_CONFIG__.vapidPublicKey`** (injected in HTML)
2. **`localStorage.getItem('hn-vapid-key')`** (user set)
3. **Environment variable** (build-time)
4. **Placeholder** (requires manual configuration)

### Backend URL Sources

1. **`window.__HN_CONFIG__.backendUrl`** (injected in HTML)
2. **Localhost** (if on localhost)
3. **Firebase default** (production)

### Configuration Example

```html
<!-- In public/index.html, before app.js -->
<script>
  window.__HN_CONFIG__ = {
    vapidPublicKey: 'BOr7...',
    backendUrl: 'https://hnwatch.cloudfunctions.net/api'
  };
</script>
```

## Common Issues

### "VAPID key not configured"

```javascript
// Check in browser console:
localStorage.getItem('hn-vapid-key')
window.__HN_CONFIG__

// Set manually:
localStorage.setItem('hn-vapid-key', 'YOUR_KEY')
```

### Notifications not arriving

```bash
# Check subscriptions stored
firebase firestore:browse
# Look in 'subscriptions' collection

# Check backend logs
firebase functions:log --only sendHourlyNotifications

# Manually trigger scheduled job
curl -X POST https://PROJECT.cloudfunctions.net/sendHourlyNotifications
```

### Tests failing

```bash
# Clean and reinstall
rm -rf node_modules functions/node_modules functions/lib
npm install && cd functions && npm install && npm run build && cd ..

# Rebuild TypeScript
cd functions && npm run build

# Run tests again
npm test
```

## Debugging

### Enable Detailed Logs

```javascript
// Service Worker (public/sw.js)
console.log('[SW] Detailed message here');

// Frontend (src/app.js)
console.log('Subscription:', subscription);
console.log('VAPID configured:', isVapidKeyConfigured());

// Backend (functions/src/index.ts)
console.log('Fetching stories, retry:', retryCount);
```

### Browser DevTools

```javascript
// Check subscription
navigator.serviceWorker.ready.then(reg => {
  return reg.pushManager.getSubscription();
}).then(sub => console.log(sub));

// Check localStorage
localStorage.getItem('hn-subscription')

// Check config
window.__HN_CONFIG__
```

## Performance Tips

- Service worker caching: All assets cached at install
- Backend retry backoff: Prevents hammering HN API
- Firestore indexes: Automatic for most queries
- Push deduplication: `tag: 'hn-notification'` (one per hour)

## Security Checklist

- [ ] VAPID keys not in git (use firebase functions:config:set)
- [ ] CORS headers set correctly
- [ ] Firestore rules restrict subscription access
- [ ] HTTPS enforced (automatic with Firebase Hosting)
- [ ] API validates subscription data
- [ ] Invalid subscriptions cleaned up (410 Gone)

## Build Output

```
public/          # Static PWA files
├── index.html   # Entry point
├── sw.js        # Service worker
└── manifest.json# PWA manifest

src/             # Frontend source
├── app.js       # Main app logic
└── config.js    # Configuration system

functions/
├── src/         # TypeScript source
│   ├── index.ts # Cloud Functions
│   └── utils.ts # Utilities
└── lib/         # Compiled JavaScript (generated)

test/
├── unit/        # Unit tests (Jest)
├── e2d/         # E2D tests (Playwright)
└── integration/ # Integration tests (Firebase emulator)
```

## One-Minute Checks

```bash
# ✓ Tests passing?
npm test 2>&1 | tail -3

# ✓ Linting clean?
npm run lint 2>&1 | grep -i error | wc -l

# ✓ Service worker loads?
curl -s http://localhost:8000/sw.js | head -20

# ✓ Frontend responds?
curl -s http://localhost:8000/ | grep -c "HN Watcher"

# ✓ Backend builds?
cd functions && npm run build && echo "✓ Build OK"
```

## Documentation Links

- **Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Manual Testing:** See [TESTING_FIREFOX_ANDROID.md](./TESTING_FIREFOX_ANDROID.md)
- **Implementation:** See [AGENTS_IMPLEMENTATION.md](./AGENTS_IMPLEMENTATION.md)
- **Project Status:** See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- **Session Work:** See [SESSION_SUMMARY.md](./SESSION_SUMMARY.md)

## Contact / Issues

- Code questions: See inline comments in relevant files
- Architecture: See AGENTS.md
- Testing help: See feature files in `features/*.feature`
- Deployment issues: See DEPLOYMENT.md troubleshooting section

# HN Watcher PWA — Quick Start Guide

## One-Time Setup

```bash
# Install dependencies
npm install && cd functions && npm install && cd ..

# Install Firebase CLI globally
npm install -g firebase-tools

# Generate VAPID keys (save somewhere safe)
npm install -g web-push
web-push generate-vapid-keys

# Initialize Firebase project
firebase init
# Select: Hosting, Functions, Firestore
# Follow prompts to link your Firebase project

# Configure VAPID keys in Cloud Functions
firebase functions:config:set vapid.public="YOUR_PUBLIC_KEY" vapid.private="YOUR_PRIVATE_KEY"

# Update src/app.js with your public VAPID key
# Update src/app.js with your backend URL (or use localhost defaults)
```

## Daily Development

### Terminal 1: Firebase Emulator
```bash
firebase emulators:start
```
Runs at:
- Hosting: `http://localhost:5000`
- Functions: `http://localhost:5001`
- Firestore: `http://localhost:8080`

### Terminal 2: Static File Server
```bash
npx http-server ./public -p 8000
```
Serves at: `http://localhost:8000`

### Terminal 3: Running Tests
```bash
# Watch mode
npm test -- --watch

# With headed browser (for notification tests)
HEADED=true npm test

# Specific test file
npm test test/e2d/subscribe.spec.ts
```

### Check Code Quality
```bash
# Lint and format check
npm run lint

# Auto-fix and format
npm run format
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature develop

# Make changes, commit
git add . && git commit -m "feat(scope): description"

# Push and create PR
git push origin feature/my-feature
# → Create PR on GitHub targeting develop

# After approval, merge to develop
# Then create release branch when ready
git checkout -b release/v0.1.0 develop
git checkout main
git merge --no-ff release/v0.1.0
git tag -a v0.1.0 -m "Version 0.1.0"
git push origin main develop --tags
```

## Project Structure at a Glance

```
├── public/              # PWA static files
│   ├── index.html      # Main page
│   ├── manifest.json   # PWA manifest
│   └── sw.js           # Service worker
├── src/                 # Frontend logic
│   └── app.js          # Subscription code
├── functions/           # Cloud Functions
│   └── src/index.ts    # API endpoints + scheduled job
├── test/                # Tests
│   ├── e2d/            # E2E tests (Playwright)
│   └── unit/           # Unit tests
├── features/            # BDD feature files
├── AGENTS.md            # Agent responsibilities & workflows
├── SETUP.md             # Detailed setup guide
├── README.md            # Project overview
└── IMPLEMENTATION_STATUS.md  # Progress tracker
```

## Common Tasks

### Debug Service Worker
1. Open DevTools (F12)
2. Go to Application tab → Service Workers
3. See registration status, push subscriptions
4. Unregister to test fresh registration

### Inspect Firestore Data (local)
```bash
# Visit Firestore emulator UI
http://localhost:8080
```

### View Cloud Functions Logs (local)
```bash
# Logs appear in the emulator terminal
firebase emulators:start
```

### Test Push Notification (local)
```bash
# Subscribe first, then send test push via curl:
curl -X POST http://localhost:5001/YOUR-PROJECT/us-central1/api/subscribe \
  -H "Content-Type: application/json" \
  -d @subscription.json

# Then trigger the scheduled function manually
# (or wait 1 hour, or modify the schedule to test)
```

### Generate Type Definitions (Functions)
```bash
cd functions && npm run build && cd ..
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Service worker not installing | Check browser console for errors, ensure `http://localhost:8000` is accessible |
| Tests timeout | Verify web server is running on port 8000 |
| VAPID key errors | Run `firebase functions:config:get` to verify keys are set |
| Firestore errors | Check emulator is running: `firebase emulators:start` |
| Permission denied | Run `firebase init` in project directory, log in with `firebase login` |

## Next Steps

1. **Frontend:** Run `npm test` and implement subscription tests
2. **Service Worker:** Test push event handling and periodic sync
3. **Backend:** Implement Firestore storage and web-push delivery
4. **Deploy:** Configure Firebase project and deploy to staging

See `IMPLEMENTATION_STATUS.md` for full roadmap.

---

**Tips:**
- Keep VAPID keys secure; never commit them
- Use Husky pre-commit hooks: `npx husky install`
- Check code quality before pushing: `npm run lint`
- Read AGENTS.md for detailed role descriptions
- Join discussions in SETUP.md troubleshooting section

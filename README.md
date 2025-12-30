# Hacker News Hourly Watcher PWA

A lightweight Progressive Web App that delivers hourly notifications of the newest Hacker News posts.

## Architecture

- **Frontend**: Vanilla JS PWA with Service Worker
- **Backend**: Firebase Cloud Functions
- **Notifications**: Web Push API (VAPID-signed)
- **Storage**: Firestore (subscriptions) + Browser IndexedDB/localStorage
- **API**: Hacker News official API

## Development

### Prerequisites

- Node.js 18+
- Firebase CLI (`npm i -g firebase-tools`)
- Biome (`npm i -D @biomejs/biome`)

### Setup

```bash
npm install
cd functions && npm install && cd ..
```

### Run Locally

```bash
# Terminal 1: Start Firebase emulators
firebase emulators:start

# Terminal 2: Start dev server
npx http-server ./public -p 8000
```

Visit `http://localhost:8000`

### Testing

```bash
# Run all tests
npm test

# Run with headed browser (for notification testing)
HEADED=true npm test

# Lint and format
npm run lint
npm run format
```

## Project Structure

```
/
├── public/
│   ├── index.html        (Main PWA page)
│   ├── manifest.json     (PWA manifest)
│   └── sw.js             (Service Worker)
├── src/
│   └── app.js            (Frontend logic)
├── functions/
│   └── src/
│       └── index.ts      (Cloud Functions)
├── features/
│   ├── subscribe.feature
│   ├── push_delivery.feature
│   └── backend_push.feature
├── test/
│   ├── e2d/              (End-to-end tests)
│   └── unit/             (Unit tests)
├── biome.json
├── playwright.config.ts
└── firebase.json
```

## BDD Development Flow

1. Create feature branch: `git checkout -b feature/short-desc`
2. Write `.feature` file in `features/`
3. Write tests in `test/e2d/` (failing)
4. Implement code to pass tests
5. Run: `npm test`
6. Push and create PR to `develop`

## Configuration

### VAPID Keys

```bash
# Generate VAPID keys (one-time)
npm install -g web-push
web-push generate-vapid-keys

# Configure in Firebase Functions
firebase functions:config:set vapid.public="PUBLIC_KEY" vapid.private="PRIVATE_KEY"
firebase functions:config:set vapid.public="YOUR_PUBLIC_KEY"
firebase functions:config:set vapid.private="YOUR_PRIVATE_KEY"
```

Update `public/app.js` with your public VAPID key.

### Backend URL

Update `BACKEND_URL` in `src/app.js` to match your deployed Functions URL.

## Deployment

```bash
# Deploy to Firebase Hosting + Functions
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting
```

## Monitoring

```bash
# View function logs
firebase functions:log
```

## Security Notes

- Push subscriptions are treated as PII-equivalent
- VAPID keys should be rotated periodically
- All push endpoints are stored encrypted
- Users can easily unsubscribe anytime

## License

MIT

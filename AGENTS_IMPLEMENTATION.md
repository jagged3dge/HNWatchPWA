# HN Watcher PWA — Agent Implementation Guide

This document describes how to implement and test features for each agent role as defined in AGENTS.md.

---

## Overview

The project uses **strict BDD-first development**:
1. Write feature file (.feature) if not exists
2. Write failing tests (Playwright E2D or Jest unit)
3. Implement minimal code to pass tests
4. Commit with conventional messages
5. Create PR to `develop` branch

---

## 1) Frontend Agent

**Files:**
- `public/index.html` — PWA page (DONE)
- `src/app.js` — subscription logic (DONE)
- `public/manifest.json` — PWA manifest (DONE)
- `test/e2d/subscribe.spec.ts` — Playwright tests
- `features/subscribe.feature` — BDD scenarios

**Status:** 80% complete (code written, tests need iteration)

### Implementation Checklist

- [x] Minimal UI with subscribe/unsubscribe buttons
- [x] Service worker registration (`navigator.serviceWorker.register`)
- [x] Notification permission request (`Notification.requestPermission`)
- [x] Push subscription (`pushManager.subscribe`)
- [x] VAPID key support with placeholder comments
- [x] Backend URL comments for easy configuration
- [ ] Test subscription flow against real service worker
- [ ] Validate service worker registration in tests
- [ ] Test localStorage fallback
- [ ] Handle permission denial gracefully

### Run Tests

```bash
# Start web server
npx http-server ./public -p 8000

# In another terminal
npm test test/e2d/subscribe.spec.ts
HEADED=true npm test  # For notification tests
```

### Feature Branch Workflow

```bash
git checkout -b feature/frontend-improve develop
# Make changes to src/app.js, test/e2d/subscribe.spec.ts
git add -A && git commit -m "test(frontend): improve subscription flow tests"
git commit -m "feat(frontend): add localStorage fallback for subscriptions"
git push origin feature/frontend-improve
# Create PR to develop
```

---

## 2) Service Worker Agent

**Files:**
- `public/sw.js` — service worker (DONE)
- `test/unit/sw.test.ts` — unit tests (DONE - comprehensive!)
- `features/push_delivery.feature` — BDD scenarios
- `test/integration/backend-push.test.ts` — integration tests

**Status:** 95% complete (all code + tests written)

### Test Coverage

The sw.test.ts file tests:
- [x] Push event handling and notification display
- [x] Notification click handling (focus existing window or open new)
- [x] Periodic sync registration (Chrome only)
- [x] Periodic sync event triggering
- [x] Manual sync message handling
- [x] HN API error handling
- [x] Time-based filtering (last hour)

### Run Tests

```bash
npm test test/unit/sw.test.ts
```

### Implementation Details

The service worker handles:

1. **Push Events** — Display notifications with story title/URL
2. **Notification Clicks** — Focus or open story URL
3. **Periodic Sync** (Chrome) — Fetch HN API, filter recent stories, show notifications
4. **Manual Sync** (Fallback) — Message-based trigger for on-demand sync
5. **HN API Integration** — Fetch `/v0/newstories.json` and item details
6. **Error Handling** — Graceful fallbacks for API failures

### Feature Branch Workflow

```bash
git checkout -b feature/sw-improvements develop
# Make changes to public/sw.js, test/unit/sw.test.ts
git commit -m "test(sw): add edge case tests for offline scenarios"
git commit -m "feat(sw): improve HN API error handling with retries"
git push origin feature/sw-improvements
```

---

## 3) Backend Agent

**Files:**
- `functions/src/index.ts` — Cloud Functions (DONE)
- `functions/src/utils.ts` — utilities (DONE)
- `functions/test/utils.test.ts` — unit tests (DONE)
- `functions/jest.config.js` — Jest configuration (DONE)
- `test/integration/backend-push.test.ts` — integration tests (skeleton)
- `features/backend_push.feature` — BDD scenarios

**Status:** 85% complete (code done, integration tests needed)

### Implementation Checklist

- [x] POST `/api/subscribe` endpoint with Firestore storage
- [x] POST `/api/unsubscribe` endpoint with deletion
- [x] Scheduled `onSchedule` Cloud Function (60 minutes)
- [x] HN API integration (fetch + filter)
- [x] Web-push integration with VAPID keys
- [x] Error handling (410 Gone cleanup, retries)
- [x] Utilities: `isNewWithinLastHour`, `hnItemToUrl`, `filterRecentItems`
- [ ] Integration tests against Firebase emulator
- [ ] Test CORS headers
- [ ] Test subscription validation
- [ ] Test scheduled job triggering

### Run Tests

```bash
cd functions

# Install dependencies
npm install

# Run unit tests
npm test

# Watch mode
npm test:watch

# Build TypeScript
npm run build
```

### Firebase Emulator Testing

```bash
# Terminal 1: Start emulator
firebase emulators:start

# Terminal 2: Test subscription endpoint
curl -X POST http://localhost:5001/YOUR-PROJECT/us-central1/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://example.com/push/endpoint",
    "expirationTime": null,
    "keys": {"p256dh": "test", "auth": "test"}
  }'

# Check Firestore emulator UI
http://localhost:8080/
```

### Feature Branch Workflow

```bash
git checkout -b feature/backend-integration develop
# Improve error handling, add retry logic
git commit -m "test(backend): add integration tests with Firebase emulator"
git commit -m "feat(backend): improve subscription validation and error messages"
git push origin feature/backend-integration
```

---

## 4) QA / Test Agent

**Files:**
- `features/*.feature` — BDD scenarios (3 files, DONE)
- `test/e2d/*.spec.ts` — Playwright tests (DONE - basic structure)
- `test/unit/*.test.ts` — Unit tests (DONE)
- `test/integration/*.test.ts` — Integration tests (skeleton)
- `playwright.config.ts` — Playwright configuration (DONE)

**Status:** 70% complete (features written, test implementation ongoing)

### Test Pyramid Strategy

```
         □ Manual Device Tests (Firefox for Android)
        □□□ Integration Tests (Firebase Emulator)
       □□□□□ E2D Tests (Playwright - real browser)
     □□□□□□□□ Unit Tests (Jest - critical logic)
```

### Running All Tests

```bash
# Unit tests (functions)
cd functions && npm test && cd ..

# Unit tests (root)
npm test test/unit/

# E2D tests (requires http-server on :8000)
npx http-server ./public -p 8000 &
npm test test/e2d/

# Integration tests (requires Firebase emulator)
firebase emulators:start &
npm test test/integration/
```

### BDD Feature Implementation

Each `.feature` file should have corresponding Playwright tests implementing the scenarios:

```gherkin
Scenario: Successful subscription
  Given I am on the app page
  When I click "Subscribe to Hacker News hourly"
  And I accept the notification permission
  Then my browser should register a service worker
  And the app should POST a subscription to /api/subscribe
```

Implement as Playwright test:
```typescript
test('Successful subscription', async ({ page }) => {
  await page.goto('/');
  await page.click('#subscribe-btn');
  // Handle permission grant (context-specific)
  // Verify SW registered
  // Verify POST to /api/subscribe
});
```

### Feature Branch Workflow

```bash
git checkout -b feature/qa-improvements develop
# Add more integration tests, improve E2D test coverage
git commit -m "test(qa): add Firebase emulator integration tests"
git commit -m "test(e2d): improve notification testing with mocks"
git push origin feature/qa-improvements
```

---

## Strict Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/short-name develop
```

Use naming: `feature/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`

### 2. Write Tests First (BDD)

- Create or update `.feature` file
- Implement Playwright or Jest tests
- Commit: `test(scope): description`
- Expected: tests fail ❌

### 3. Implement Code Minimal

- Write minimal code to pass tests
- Commit: `feat(scope): description` or `fix(scope): ...`
- Expected: tests pass ✅

### 4. Iterate Until Complete

- Refactor, improve error handling
- Run: `npm run lint`, `npm run format`
- Commit: `refactor(scope): ...`

### 5. Push & Create PR

```bash
git push origin feature/short-name
# Create PR on GitHub targeting develop
# Link to feature file and test coverage
```

### 6. Merge to Develop

After review and CI passes:
```bash
# Reviewer merges PR
# Delete feature branch
git branch -D feature/short-name
```

---

## Conventional Commits

Always use:
```
type(scope): description

[optional body]
[optional footer]
```

**Types:**
- `feat:` new feature
- `fix:` bug fix
- `test:` test addition/improvement
- `refactor:` code restructure
- `docs:` documentation
- `chore:` maintenance
- `ci:` CI/CD changes
- `perf:` performance

**Examples:**
```
feat(frontend): add localStorage fallback for subscriptions
fix(sw): handle periodic sync registration errors gracefully
test(backend): add Firestore integration tests
docs(setup): clarify VAPID key configuration steps
refactor(push): simplify notification payload generation
```

---

## Acceptance Gates Before Release

A feature is ready for PR when:

- ✅ All tests pass locally: `npm test`
- ✅ Linting passes: `npm run lint`
- ✅ Code formatted: `npm run format`
- ✅ Feature file (if new) is complete
- ✅ Conventional commit messages used
- ✅ No console errors/warnings
- ✅ Service worker tests pass (unit tests)
- ✅ E2D tests pass (may require `HEADED=true npm test`)

A feature is ready to merge to `main` when:

- ✅ PR approved
- ✅ CI pipeline passes (GitHub Actions)
- ✅ Manual device testing complete (notification features)
- ✅ No merge conflicts
- ✅ Security review done (VAPID keys, subscriptions)

---

## Quick Reference

| Agent | Key Files | Status | Tests |
|-------|-----------|--------|-------|
| Frontend | `public/index.html`, `src/app.js` | 80% | `test/e2d/subscribe.spec.ts` |
| Service Worker | `public/sw.js` | 95% | `test/unit/sw.test.ts` (✅ comprehensive) |
| Backend | `functions/src/index.ts`, `utils.ts` | 85% | `functions/test/utils.test.ts` (✅ complete) |
| QA/Test | `features/`, `test/` | 70% | All test files |

---

## Troubleshooting

### Tests fail with "module not found"

```bash
# Reinstall dependencies
npm install
cd functions && npm install && cd ..
```

### Service worker tests fail

```bash
# Ensure sw.js is accessible
npx http-server ./public -p 8000

# Check sw.js syntax
npm run lint
```

### Firebase emulator fails to start

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize if needed
firebase init

# Start emulator
firebase emulators:start --only functions,firestore,hosting
```

### E2D tests timeout

Increase timeout in `playwright.config.ts`:
```typescript
test.setTimeout(30000);
```

---

## Next Steps

1. **Complete Frontend Agent:**
   - [ ] Run `npm test test/e2d/subscribe.spec.ts`
   - [ ] Fix failing tests
   - [ ] Add localStorage persistence tests
   - [ ] Test against real Firebase emulator

2. **Enhance Backend Agent:**
   - [ ] Set up Firebase project
   - [ ] Configure VAPID keys
   - [ ] Test with Firebase emulator
   - [ ] Add retry logic for failed sends

3. **Improve QA:**
   - [ ] Add manual device testing runbook (Firefox for Android)
   - [ ] Create test fixtures for HN API responses
   - [ ] Add performance benchmarks

4. **Release Preparation:**
   - [ ] Security audit of VAPID key handling
   - [ ] Document rollback procedures
   - [ ] Create deployment playbook

See IMPLEMENTATION_STATUS.md for full roadmap.

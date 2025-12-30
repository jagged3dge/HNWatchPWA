# Lightweight Hacker News Tracker PWA — full agent playbook

## Purpose

A single-purpose, minimal Progressive Web App (PWA) that notifies the user of Hacker News "newest" posts published in the last hour, once every hour. Primary runtime target: **Firefox for Android** (push-driven). Secondary enhancement: use **Periodic Background Sync** where available (Chrome family) as a battery-friendly local fallback.

This document defines agents (roles), responsibilities, coding prompts, quality gates, BDD test patterns, CI/CD, release rules, and the strict engineering workflow required to implement, test, and operate the app.

---

## High-level architecture

* Frontend: minimal static SPA with brutalist design theme (index.html + tiny JS), PWA manifest, `sw.js` service worker.
* Service worker responsibilities: register for push, handle `push` events, show notifications, handle notification click to open remote URL, implement Periodic Background Sync registration when available.
* Backend: Firebase Cloud Function scheduled hourly (Cloud Scheduler via `onSchedule`) that polls Hacker News API and sends Web Push messages to subscribed clients using VAPID keys.
* Storage: browser-side IndexedDB (or localStorage as fallback) to store `lastSeenTimestamp` and subscription metadata. Backend stores subscriptions (encrypted) and VAPID key in Function environment variables.

ASCII diagram

```
Browser (PWA)
  - index.html   (Subscribe button)
  - sw.js        (service worker)
      registers periodic sync (Chrome) and push subscription
      handles push and notificationclick

Firebase Cloud Functions
  - /api/subscribe  -> stores push subscription
  - scheduled / hourly -> fetch HN API -> compute delta -> send web-push
  - optional admin endpoints to manage subscriptions

HackerNews API (official)
  - /v0/newstories.json
  - /v0/item/<id>.json
```

---

## Non-goals and constraints

* No custom UI other than a single compact settings/subscription page.
* No authentication required — subscription is anonymous but tracked by subscription id.
* No heavy frameworks; vanilla JS + small helper libs permitted.
* Strict BDD-first development; tests are required before implementation; e2d integration tests are the primary test surface. Unit tests only for critical, deterministic logic (e.g., `isNewWithinLastHour(timestamp)`).
* Strict `git-flow` branching model + conventional commit messages.
* Biome is the linter + formatter for the entire repo.
* Free deployment using Firebase Hosting + Cloud Functions.

---

## Agents (roles) — responsibilities & deliverables

For the purposes of automation and parallel work, we define agent roles. Each agent must follow prompts below and produce artifacts and tests in BDD format.

### 1) Frontend Agent (minimal UI + registration)

**Primary goal:** small single page that asks permission and registers the user for push. Provide a visible subscribe button, a tiny status area, and an uninstall/forget button.

**Deliverables**

* `index.html`, `app.js`, `manifest.json`, basic CSS.
* `subscribe()` flow that requests Notification permission, registers service worker, and sends subscription object to backend `/api/subscribe` endpoint.
* BDD feature: `features/subscribe.feature` (Gherkin) describing happy path + denied permission + re-subscribe.
* E2D tests: Playwright scenarios that run in `serviceWorkers: 'allow'` mode and validate subscription API is called and subscription stored locally.

**Coding‑agent prompt (Frontend)**

> Write a minimal `index.html` and `app.js` that:
>
> * Shows a single "Subscribe to Hacker News hourly" button and a status line.
> * On click: requests `Notification` permission; registers `sw.js`; calls `navigator.serviceWorker.ready` to obtain registration; subscribes to `PushManager.subscribe` (use `applicationServerKey` placeholder); sends subscription JSON to `POST /api/subscribe`.
> * Provides a UI control to "Unsubscribe" that calls the service worker to unsubscribe and calls `POST /api/unsubscribe`.
> * Include comments pointing to where to replace VAPID key and backend URL.
> * Add BDD feature file with examples and minimal Playwright test skeleton.

---

### 2) Service Worker Agent (sw.js)

**Primary goal:** handle push events and periodic sync when available.

**Responsibilities**

* Listen for `push` events and call `self.registration.showNotification(title, options)`.
* Provide `notificationclick` handler to `clients.openWindow(url)` and focus if open.
* Attempt to register Periodic Sync on install if `registration.periodicSync` exists; register a tag like `hn-periodic-sync` with `minInterval: 60*60*1000`.
* Provide a fallback to perform an on-demand fetch when the foreground tab triggers a manual sync.

**Deliverables**

* `sw.js` with robust feature detection and graceful error handling.
* BDD: `features/push_delivery.feature` with scenarios for receiving a push, linking to URL, and periodic sync fetching new items (Chrome only qualifiers included).
* E2D tests: Playwright tests that simulate a push event via the browser devtools or via injecting a `dispatchEvent(new PushEvent(...))` in the worker context (mocked where necessary).

**Coding‑agent prompt (Service Worker)**

> Implement `sw.js` that:
>
> * Implements `self.addEventListener('push', ...)` to parse `event.data.json()` and show a notification with `data.title` and `data.url`.
> * Implements `self.addEventListener('notificationclick', ...)` to open the URL in a new tab and `clients.closeWindow()` as appropriate.
> * On `install` or `activate`, attempt to register `periodicSync` using `registration.periodicSync.register('hn-hourly', {minInterval: 60*60*1000})` only if `registration.periodicSync` exists.
> * On `periodicsync` event, fetch `newstories` via HN API, filter last-hour items, show notifications directly (no backend push required). Add feature-detect fallbacks and logging.
> * Keep the worker small and well-documented.

---

### 3) Backend Agent (Firebase Cloud Functions)

**Primary goal:** provide subscription endpoints and a scheduled job that polls Hacker News and sends Web Push notifications reliably for Firefox for Android and other browsers that rely on push.

**Responsibilities**

* Implement `POST /api/subscribe` to store subscriptions securely (Firestore or Realtime DB) and return 200.
* Implement `POST /api/unsubscribe` to remove subscription.
* Implement a scheduled `onSchedule` Cloud Function (hourly) that:

  * Fetches `newstories.json` and item details for recent items.
  * Filters items published within the past hour.
  * For each stored subscription, send a Web Push message (using `web-push` Node library) with `title` and `url`.
  * Respect push quotas and batch sends.
* Store VAPID private key securely in Functions config (`firebase functions:config:set vapid.private=...`), or use Secret Manager for production.

**Deliverables**

* `functions/src/index.ts` (TypeScript) with typed request/response and unit tests for the filter logic.
* BDD features: `features/backend_push.feature` describing scheduling, subscription flow, and push delivery.
* E2D integration: run scheduled function locally (via emulator) or run the function on Firebase and assert notifications received by a test device (or mock subscription in Playwright).

**Coding‑agent prompt (Backend)**

> Create a Firebase Cloud Function project scaffold that:
>
> * Exposes `POST /api/subscribe` and `POST /api/unsubscribe` endpoints that store/remove push subscriptions in Firestore.
> * Exposes a scheduled function using `onSchedule('every 60 minutes')` (or equivalent `firebase-functions/v2/scheduler`) that fetches Hacker News `newstories`, resolves items, filters by last-hour, and sends web-push to stored subscriptions.
> * Use `web-push` library with VAPID keys read from environment variables. Include error handling for expired/invalid subscriptions and cleanup.
> * Add unit tests for the time-filtering function and mock `web-push` in tests.

---

### 4) QA / Test Agent (BDD + E2D integration)

**Primary goal:** own acceptance criteria and the e2d pipeline. Tests must be written before code (BDD). The team practices *e2d integration-first* (end-to-device): tests must exercise the real service worker behavior and a real browser where feasible.

**Testing principles**

* Tests are written in Gherkin (`.feature`) files in `features/` and implemented using a runner that supports BDD style (Cucumber, or Playwright test harness with Gherkin glue).
* E2D integration tests use Playwright as the primary runner for cross-browser testing; headful mode is used when testing Notifications and Service Worker interactions.
* When notification delivery cannot be fully validated in CI (web push to a real device), the test harness must include deterministic mocks (e.g., invoke `self.registration.dispatchEvent(new PushEvent(...))` in `sw.js` test harness), and a small set of manual test instructions for device validation.

**Deliverables**

* `features/*.feature` files with clear acceptance criteria.
* Playwright test suites under `test/e2d/` that implement BDD scenarios.
* A small set of unit tests under `test/unit/` for time-based filters and push payload generation.

**Examples (Gherkin)**

```gherkin
Feature: Subscribe to Hacker News notifications
  Scenario: Successful subscription
    Given I am on the app page
    When I click "Subscribe to Hacker News hourly"
    And I accept the notification permission
    Then my browser should register a service worker
    And the app should POST a subscription to /api/subscribe

Feature: Notification receives and opens URL
  Scenario: Receive push and open story
    Given a registered push subscription
    When the backend sends a push for a new item
    Then the service worker should display a notification with the story title
    And clicking the notification should open the story URL in a new tab
```

---

## Testing caveats & strategies

* **Push notifications in headless CI** are fragile. Use `headed` mode and a browser profile in Playwright for notification tests or mock push events on the worker when running in CI.
* **Periodic Sync** behavior is browser-managed — tests should verify the registration and that the handler code is correct; do not rely on exact hourly wakeups in CI. Instead, unit-test the handler logic and manually verify behavior on Chrome devices where available.
* **Device validation**: include a small runbook for manual checks on Firefox for Android (install PWA, accept notifications, verify scheduled delivery over 2–3 hours). The runbook is a required acceptance gate for release.

---

## BDD / Development flow (strict)

1. Create a *feature branch* from `develop` named `feature/<short-desc>` (per git-flow). Example: `feature/hN-push-subscribe`.
2. Create a single Gherkin `.feature` file for the behaviour to implement (placed under `features/`).
3. Implement BDD steps as Playwright tests or Cucumber glue. Commit tests only — failing test run is expected at this stage.
4. Implement the minimal code to satisfy the tests. Iterate until E2D tests pass locally.
5. Push to remote; create a PR targeting `develop`.
6. Continuous integration runs linter (biome), formats, then e2d test suite (Playwright with `--headed` for notification tests requiring it). Only merge when all checks green and at least one manual device validation plan is attached for notification-related features.

**Branch and release rules (git-flow)**

* `main` (or `master`) is always deployable and protected. Releases are created from `develop` via a `release/*` branch and merged into `main` + `develop` per git-flow.
* Hotfixes are cut as `hotfix/<name>` from `main`.

**Conventional commits**

* Use conventional commit messages: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`, `perf:`, `refactor:`.
* Examples:

  * `feat(push): add subscribe/unsubscribe endpoints`
  * `fix(sw): open story URLs in new tab on notification click`
  * `test(bdd): add feature test for subscription flow`

Pre-commit / hooks

* Run `biome format --write` and `biome lint --fix` as pre-commit hooks. We recommend Husky or simple npm `prepare`/`precommit` scripts to wire checks.

---

## Tooling & config

* **Formatting & Linting**: Biome (formatter + linter). Add `biome` config at repo root and CI steps to run `biome check` and `biome format --write` as needed.
* **E2D & BDD Runner**: Playwright (`@playwright/test`) with `serviceWorkers: 'allow'` in config and `headed` flag for notification tests where required. Use Playwright fixtures for setup/teardown.
* **Push library**: `web-push` (Node) in Firebase Functions to send VAPID-signed push messages and handle errors. Backend code must cleanup invalid subscriptions.
* **Hosting & Scheduler**: Firebase Hosting + Cloud Functions with `onSchedule` scheduler (Cloud Scheduler under the hood).
* **CI/CD**: GitHub Actions with jobs:

  * `lint-format` (biome)
  * `unit-tests` (node)
  * `e2d-tests` (Playwright; separate matrix for headless/headed)
  * `deploy` (deploy to Firebase on `main` for production; `develop` to staging)

---

## Acceptance criteria & release checklist

Before a release to `main`/production:

* All `features/*.feature` tests pass locally and in CI.
* Playwright e2d suite passes in CI with `--headed` for any tests that assert Notifications behavior OR documented manual device test with screenshots/video attached.
* Biome formatting and linting pass.
* VAPID keys are present in Functions config or Secret Manager.
* A runbook for manual verification (install PWA on Firefox for Android and observe one scheduled push) is included.
* A rollback plan exists (remove send permissions/disable scheduler) and a hotfix branch template is ready.

---

## Security & privacy notes

* Push subscriptions are ephemeral — treat endpoint data as PII-equivalent. Store encrypted if necessary and rotate VAPID keys periodically.
* Respect user opt-out: provide an easy Unsubscribe and a way to toggle notification frequency.
* Rate limit the scheduled job to avoid hammering HN API; cache `newstories.json` and request only item details for candidate IDs.

---

## Maintenance & monitoring

* Monitor Cloud Function error logs and push delivery failures (remove invalid subscriptions automatically after repeated failures).
* Add lightweight analytics events for subscription counts and delivery success (opt-in only).

---

## Appendices

### A — Example file layout

```
/ (repo)
  /public
    index.html
    manifest.json
    sw.js
  /src
    app.js
  /functions
    src/index.ts
    package.json
  /features
    subscribe.feature
    push_delivery.feature
  /test
    e2d/
    unit/
  biome.config.json
  playwright.config.ts
  .github/workflows/ci.yml
```

### B — Minimal Playwright config snippet

```js
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    headless: false, // run headed for notification tests in CI job dedicated for it
    serviceWorkers: 'allow',
  }
});
```

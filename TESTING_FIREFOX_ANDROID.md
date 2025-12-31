# HN Watcher PWA — Manual Testing on Firefox for Android

This document provides step-by-step instructions for testing the Hacker News Watcher PWA on Firefox for Android.

---

## Prerequisites

- Android device (phone or tablet)
- Firefox for Android installed from Google Play Store
- Internet connection (WiFi or mobile data)
- Your PWA deployed to Firebase Hosting or local development server

---

## Part 1: Installation on Home Screen (PWA Setup)

### Step 1.1: Open PWA in Firefox

1. Open Firefox for Android
2. Navigate to your PWA URL:
   - Production: `https://<YOUR_PROJECT>.web.app`
   - Development: `http://<YOUR_PC_IP>:8000` (if serving locally)

### Step 1.2: Install to Home Screen

1. Wait for page to fully load
2. Tap the **three-dot menu** (⋮) in the bottom-right
3. Tap **"Add to home screen"**
4. The browser will prompt you to:
   - Confirm the app name (default: "Hacker News Watcher")
   - Confirm the icon
5. Tap **"Add"** to install

### Step 1.3: Launch from Home Screen

1. Press the home button to go to the Android home screen
2. You should see a new app icon: "HN Watcher" or similar
3. Tap the icon to launch the PWA
4. The app should open full-screen (no address bar)

### Step 1.4: Verify Service Worker Installed

1. With the PWA open, tap the three-dot menu
2. Look for **"Manage app"** or **"App settings"**
3. The service worker should be active (you'll see it in browser DevTools if available)

---

## Part 2: Testing Subscription Flow

### Step 2.1: Subscribe to Notifications

1. With the PWA open, look for the **"Subscribe"** button
2. Status should show: **"Ready to subscribe"**
3. Tap **"Subscribe"** button
4. Browser will prompt: **"Allow notifications from HN Watcher?"**
5. Tap **"Allow"** to grant permission

### Step 2.2: Verify Subscription

Wait for status message to show: **"Successfully subscribed ✓"**

If subscription succeeds:
- Status turns green (CSS class `subscribed`)
- Button text changes to "Unsubscribe"
- Subscription is saved locally and sent to backend

If subscription fails:
- Status shows error message in red
- Check browser console for detailed error (see Step 2.4)

### Step 2.3: Verify Subscription Stored

1. Tap the three-dot menu
2. Tap **"Settings"** > **"Applications"** > **"Notifications"**
3. Confirm "HN Watcher" appears in the list and notifications are **"On"**

### Step 2.4: View Debug Logs (Optional)

1. Open Firefox DevTools:
   - On Android, enable **USB Debugging** in developer options
   - Connect to PC via USB
   - In Firefox on PC, go to `about:debugging`
   - Click "This Firefox" > "Connect to a Network Device"
2. Access console logs to debug any issues

---

## Part 3: Testing Notification Delivery

### Step 3.1: Manual Trigger (Development Only)

If you have backend access, manually trigger the scheduled function:

```bash
# From your PC
curl -X POST \
  https://<YOUR_PROJECT>.cloudfunctions.net/sendHourlyNotifications \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"
```

### Step 3.2: Wait for Hourly Notification

1. Keep the app installed and subscribed
2. Wait for the next hour (or trigger manually as shown above)
3. A notification should appear on your Android device

### Step 3.3: Verify Notification Appears

**Expected behavior:**
- Notification appears in notification center (swipe down from top)
- Notification title: Story title from Hacker News
- Notification body: Author name and score (e.g., "by dang • 425 points")
- Notification icon: HN favicon

**If notification doesn't appear:**
1. Check notification settings (Step 2.3)
2. Ensure WiFi/data is connected
3. Check backend logs for errors
4. Verify VAPID keys are configured correctly

### Step 3.4: Interact with Notification

1. When notification appears, **tap** it
2. Browser should open the story URL in a new tab
3. Verify the story loads correctly

**If clicking doesn't work:**
1. Check service worker logs
2. Verify notification handler in `public/sw.js` is correct
3. Check that service worker is active

---

## Part 4: Testing Notification Permissions Denial

### Step 4.1: Revoke Permissions

1. Go to Android **Settings**
2. Find **Applications** > **Firefox**
3. Tap **Permissions**
4. Disable **Notifications** permission
5. Return to the PWA

### Step 4.2: Try to Subscribe

1. Tap **"Subscribe"** button in the PWA
2. App should request permission again
3. Tap **"Deny"** or let timeout occur
4. Status should show error: **"Notification permission denied"**

### Step 4.3: Re-enable Permissions

1. Return to Android Settings > Firefox > Permissions
2. Re-enable **Notifications**
3. Return to PWA and verify **"Subscribe"** button is enabled again

---

## Part 5: Testing Unsubscribe

### Step 5.1: Unsubscribe

1. With the PWA open and subscribed, tap **"Unsubscribe"** button
2. Status should show: **"Unsubscribed ✓"**
3. Button should return to **"Subscribe"**

### Step 5.2: Verify Unsubscribe

1. After unsubscribing, wait for the next hourly check
2. **No notification should appear**
3. Subscription should be removed from backend

---

## Part 6: Long-Running Test (2-3 Hours)

### Objective

Verify the PWA reliably delivers notifications over multiple hours.

### Setup

1. Subscribe to notifications
2. Note the current time
3. Keep the device on and connected to WiFi

### Monitor

1. **Hour 1**: Verify first notification appears and is tappable
2. **Hour 2**: Verify second notification appears
3. **Hour 3**: Verify third notification appears

### Expected Results

- All notifications arrive within a few minutes of the scheduled time
- Notification content changes with each new story
- Clicking opens the correct story URL
- No errors in backend logs
- Subscriptions remain active in Firestore

---

## Part 7: Testing Offline Behavior

### Offline Scenario 1: Subscribe While Offline (Won't Work)

1. Enable **Airplane Mode**
2. Try to subscribe
3. Should show error: **"Failed to fetch"`
4. Disable Airplane Mode
5. Try again - should work

### Offline Scenario 2: View App While Offline

1. Subscribe while online
2. Enable **Airplane Mode**
3. Open the PWA
4. App should load from cache (service worker)
5. Buttons should be visible but grayed out

### Offline Scenario 3: Receive Notification While Offline

1. Subscribe while online
2. Ensure notifications are enabled
3. Enable **Airplane Mode**
4. Wait for scheduled notification time
5. When device comes back online, notification may appear

---

## Troubleshooting

### Notification Never Appears

1. **Check subscription stored:**
   - Open browser DevTools
   - Run: `localStorage.getItem('hn-subscription')`
   - Should return subscription object with `endpoint`

2. **Check Firestore:**
   - In Firebase Console, check 'subscriptions' collection
   - Your subscription should appear with unique ID

3. **Check backend logs:**
   ```bash
   firebase functions:log --only sendHourlyNotifications
   ```
   - Look for errors sending to your subscription

4. **Check notification settings:**
   - Android Settings > Applications > Firefox > Notifications (should be **On**)
   - Android Settings > Notifications > HN Watcher (should be **On**)

5. **Verify VAPID keys:**
   - Backend must have correct private VAPID key
   - Frontend must have corresponding public key
   - Run: `firebase functions:config:get` to verify

### Notification Appears But Clicking Doesn't Work

1. Check service worker is active:
   - Open DevTools > Application > Service Workers
   - Status should be **Active and running**

2. Check notification click handler in `public/sw.js`
3. Verify story URL is present in notification data

### App Crashes or Freezes

1. Close all Firefox tabs
2. Restart Firefox
3. Clear cache: Settings > Applications > Firefox > Clear data
4. Reinstall PWA to home screen
5. If issue persists, check browser console for JavaScript errors

### VAPID Key Configuration Error

1. Message: **"VAPID key not configured. Contact administrator."**
2. Solutions:
   - Inject key via `window.__HN_CONFIG__` in HTML
   - Update `src/config.js` to load key from environment
   - Restart app after configuration change

---

## Test Checklist

- [ ] App installs to home screen
- [ ] Subscribe button works
- [ ] Notification permission requested and granted
- [ ] Status shows "Successfully subscribed ✓"
- [ ] Subscription appears in Firestore
- [ ] Hourly notification arrives
- [ ] Notification title/body display correctly
- [ ] Clicking notification opens story URL
- [ ] Unsubscribe button works
- [ ] No notifications arrive after unsubscribe
- [ ] App works while offline (cached)
- [ ] No console errors or warnings
- [ ] Battery usage is reasonable
- [ ] Multiple notifications arrive reliably over 3 hours

---

## Logging Device Activities

To capture issues:

1. **Screenshot**: Tap Power + Volume Down simultaneously
2. **Record screen**: Long-press Power > Record > Start
3. **Check logs**: `adb logcat | grep firefox` (requires USB debugging)

Include screenshots/videos with any bug reports.

---

## Reporting Issues

If you encounter problems:

1. Note the exact time issue occurred
2. Check backend logs:
   ```bash
   firebase functions:log --only sendHourlyNotifications
   ```
3. Check browser console (if accessible)
4. Include:
   - Device model and Android version
   - Firefox version
   - Screenshots of the issue
   - Logs from backend

---

## Next Steps

- Monitor error logs for a week
- Collect feedback from test users
- Adjust notification frequency if needed
- Plan for larger device testing if issues not found

---

For additional questions, see [DEPLOYMENT.md](./DEPLOYMENT.md) and [README.md](./README.md).

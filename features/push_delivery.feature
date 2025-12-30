Feature: Receive and interact with push notifications
  As a subscribed user
  I want to receive push notifications with new HN stories
  So that I can quickly access interesting content

  Scenario: Receive push notification with story details
    Given a valid push subscription is registered
    When the backend sends a push message with story data
    Then the service worker should receive the push event
    And a notification should be displayed with the story title and author
    And the notification data should include the story URL

  Scenario: Click notification to open story
    Given a notification is displayed with a story URL
    When I click on the notification
    Then a new tab should open with the story URL
    And the notification should be closed
    And the existing story tab should remain focused if already open

  Scenario: Periodic sync for Chrome browsers
    Given I am on a Chrome-based browser
    And the service worker is installed
    When the service worker activates
    Then periodic sync should be registered with tag "hn-hourly"
    And the minInterval should be 60 minutes

  Scenario: Periodic sync fetches recent stories (Chrome)
    Given periodic sync is registered (Chrome only)
    When the periodic sync event is triggered
    Then the service worker should fetch /v0/newstories.json from HN API
    And only stories from the last hour should trigger notifications
    And older stories should be silently skipped

  Scenario: Manual sync fallback
    Given the app is open in the foreground
    And periodic sync is not available or not triggered yet
    When the user requests a manual sync via message event
    Then the service worker should fetch HN stories
    And show notifications for recent items

  Scenario: Handle invalid push data gracefully
    Given a valid push subscription is registered
    When the backend sends a push message with malformed JSON
    Then the service worker should not crash
    And a generic notification should be displayed
    And the error should be logged to console

  Scenario: Handle HN API errors gracefully
    Given periodic sync is attempting to fetch stories
    When the HN API is unavailable or times out
    Then the service worker should catch and log the error
    And no notification should be displayed
    And the next periodic sync should still be scheduled

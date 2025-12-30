Feature: Subscribe to Hacker News notifications
  As a user
  I want to subscribe to hourly Hacker News notifications
  So that I can stay updated on newest posts

  Scenario: Successful subscription
    Given I am on the app page
    When I click "Subscribe" button
    And I accept the notification permission
    Then the service worker should be registered
    And the app should POST the subscription to /api/subscribe
    And the status should show "Successfully subscribed!"
    And the "Subscribe" button should be disabled
    And the "Unsubscribe" button should be enabled

  Scenario: Notification permission denied
    Given I am on the app page
    When I click "Subscribe" button
    And I deny the notification permission
    Then the status should show an error message
    And the "Subscribe" button should remain enabled
    And the "Unsubscribe" button should remain disabled

  Scenario: Already subscribed on page load
    Given I was previously subscribed
    When I load the app page
    Then the service worker should be registered
    And the subscription should be retrieved from push manager
    And the status should show "Already subscribed"
    And the "Subscribe" button should be disabled
    And the "Unsubscribe" button should be enabled

  Scenario: Unsubscribe from notifications
    Given I am subscribed to notifications
    When I click "Unsubscribe" button
    Then the app should POST to /api/unsubscribe
    And the push subscription should be cancelled
    And the subscription should be cleared from localStorage
    And the status should show "Unsubscribed"
    And the "Subscribe" button should be enabled
    And the "Unsubscribe" button should be disabled

Feature: Backend push notification delivery
  As a service operator
  I want the backend to reliably send push notifications to subscribed users
  So that users receive timely updates about new HN stories

  Scenario: Store user subscription
    Given the app calls POST /api/subscribe with a valid subscription
    When the backend receives the subscription object
    Then the subscription should be stored in Firestore
    And the endpoint should return 200 OK
    And no errors should be logged

  Scenario: Remove user subscription
    Given a user subscription is stored
    When the app calls POST /api/unsubscribe with the subscription
    Then the subscription should be removed from Firestore
    And the endpoint should return 200 OK
    And subsequent pushes should not be sent to this subscription

  Scenario: Scheduled function runs hourly
    Given the backend Cloud Function is deployed
    When Cloud Scheduler triggers the scheduled function
    Then the function should complete within timeout limits
    And logs should show the function executed successfully
    And no unhandled exceptions should occur

  Scenario: Fetch and filter HN stories
    Given the scheduled function is running
    When it fetches /v0/newstories.json from HN API
    Then it should retrieve the array of story IDs
    And it should fetch details for the top recent items
    And it should filter items published in the last 60 minutes
    And older items should be excluded from sending

  Scenario: Send push to all subscriptions
    Given there are 5 active subscriptions stored
    And there are 2 new HN stories from the last hour
    When the scheduled function runs
    Then it should send push messages to all 5 subscriptions
    And each push should contain story title and URL
    And delivery should respect Web Push API quotas

  Scenario: Handle expired subscriptions gracefully
    Given some stored subscriptions are expired or invalid
    When the scheduled function sends push messages
    Then failed sends should be caught and logged
    And expired subscriptions should be removed from storage
    And the function should continue processing other subscriptions

  Scenario: Respect VAPID key configuration
    Given the Cloud Function is configured with VAPID keys
    When push messages are sent
    Then the messages should be signed with the VAPID private key
    And the VAPID public key should match the client's configuration
    And unsigned or incorrectly signed messages should not be sent

  Scenario: Handle HN API errors gracefully
    Given the scheduled function is running
    When the HN API is unavailable or returns an error
    Then the function should log the error
    And no push messages should be sent (to avoid duplicate alerts)
    And the function should exit gracefully
    And the next scheduled run should still occur

  Scenario: Rate limit HN API requests
    Given the backend makes multiple calls to HN API per run
    When caching is implemented
    Then repeated requests for newstories.json should use cached results
    And individual item fetches should be batched if possible
    And total API calls per hour should be minimized

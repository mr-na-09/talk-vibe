# Push notification setup

TalkVibe should use a secure server-side notification workflow. The mobile app receives push tokens from Expo / Firebase / APNs, and the backend stores those tokens in the PocketBase `device_tokens` collection with the authenticated user and platform.

## Required services

- PocketBase auth for the identity layer
- A PocketBase hook or separate secure server for sending notifications
- Firebase Cloud Messaging for Android
- Apple Push Notification service for iOS
- Expo Notifications for device registration and delivery support

## Recommended workflow

1. Register a device token after app install.
2. Store the token in `device_tokens`; collection rules limit access to its owner.
3. When a message or friend request arrives, trigger a server-side notification write.
4. Send only to the target user’s active devices.
5. Validate the recipient user, conversation access, and push token ownership on the server.

## Required environment values

- `NEXT_PUBLIC_POCKETBASE_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `APPLE_KEY_ID`
- `APPLE_TEAM_ID`
- `APPLE_PRIVATE_KEY`

Keep Firebase/APNs credentials on the server. Never add provider secrets to `NEXT_PUBLIC_` frontend variables.

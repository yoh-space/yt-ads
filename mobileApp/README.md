# Expo Push Easy - Convex Example

A complete example demonstrating how to send FCM push notifications using `expo-push-easy` with Convex as the backend.

## Features

- 🔔 FCM v1 push notifications using Firebase Cloud Messaging
- 🚀 Server-side notification sending via Convex actions
- 💾 Token storage and management with Convex database
- 📱 React Native client with Expo
- 🔒 Secure JWT signing using Web Crypto API

## Prerequisites

- Node.js 18+ and pnpm
- Expo CLI (`npm install -g expo-cli`)
- Firebase project with Cloud Messaging enabled
- Convex account (https://convex.dev)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create or select your project
3. Navigate to **Project Settings** → **Service Accounts**
4. Click **Generate new private key**
5. Save the JSON file as `service-account.json` in this directory

### 3. Set Up Convex

```bash
# Login to Convex
npx convex dev

# Set the FCM service account (replace with your actual service account JSON)
npx convex env set FCM_SERVICE_ACCOUNT '{"type":"service_account","project_id":"your-project-id",...}'

# Or use the service-account.json file
npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"
```

### 4. Configure Environment Variables

Create a `.env.local` file:

```env
# Convex (automatically set by `npx convex dev`)
CONVEX_DEPLOYMENT=dev:your-deployment-name
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### 5. Run the App

```bash
# Start Convex dev server (in one terminal)
npx convex dev

# Start Expo (in another terminal)
npx expo start
```

## How It Works

### Client-Side (React Native)

1. **Request Permissions**: The app requests notification permissions from the user
2. **Register FCM Token**: Uses `registerForPushNotifications({ useDevicePushToken: true })` to get a raw FCM registration token
3. **Save Token**: Stores the token in Convex database via mutation
4. **Send Notification**: Calls a Convex action that uses `expo-push-easy` to send notifications

### Server-Side (Convex)

1. **Token Storage**: Convex mutations save/retrieve tokens from the database
2. **Send Action**: Convex action uses `send()` from `expo-push-easy` which:
   - Auto-detects the token type (FCM vs Expo Push)
   - Signs JWT using Web Crypto API for FCM authentication
   - Sends notification via FCM v1 API

## Key Files

- `app/(tabs)/index.tsx` - Main UI with notification controls
- `convex/notify.ts` - Server-side notification sending action
- `convex/pushTokens.ts` - Token storage mutations/queries
- `convex/schema.ts` - Database schema for tokens
- `lib/notifications.ts` - Notification channel setup

## Testing

1. Press **"Setup FCM Push Notifications"** to register your device
2. Verify the FCM token is displayed (starts with letters like `fY-...`)
3. Enter a title and body for your test notification
4. Press **"Send Test Notification"**
5. Check the notification appears on your device!

## Troubleshooting

### "Property 'crypto' doesn't exist" Error

This means you tried to call `send()` from the client-side. The `expo-push-easy` library uses Web Crypto API which is only available server-side (Convex, Node.js, etc.).

**Solution**: Always send notifications from Convex actions, not directly from React Native.

### "No 'projectId' found" Error

When using `useDevicePushToken: false` (default), you need an Expo project ID.

**Solution**: Use `useDevicePushToken: true` to get raw FCM tokens that don't require a project ID.

### Notification Not Received

1. **Check FCM Service Account**: Verify it's set in Convex with `npx convex env list`
2. **Check Logs**: Look at Convex logs with `npx convex logs` for FCM errors
3. **Verify Channel**: Android 8.0+ requires notification channels (automatically created in this example)
4. **Check Token**: Ensure the token starts with random letters (FCM) not `ExponentPushToken`

### "SyntaxError: Expected property name" in JSON

The `FCM_SERVICE_ACCOUNT` environment variable is malformed.

**Solution**: Use the exact command format:
```bash
npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"
```

## Architecture

```
┌─────────────────────┐
│   React Native App  │
│  (Expo + expo-      │
│   push-easy/client) │
└──────────┬──────────┘
           │
           │ 1. Register FCM Token
           │ 2. Call Convex Action
           ▼
┌─────────────────────┐
│   Convex Backend    │
│  - Token Storage    │
│  - Send Action      │
└──────────┬──────────┘
           │
           │ expo-push-easy:
           │ - Auto-detect token type
           │ - Sign JWT (Web Crypto)
           │ - Call FCM v1 API
           ▼
┌─────────────────────┐
│   Firebase Cloud    │
│    Messaging API    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   User's Device     │
│   (Notification)    │
└─────────────────────┘
```

## Learn More

- [expo-push-easy Documentation](https://github.com/yoh-space/expo-push-easy)
- [Convex Documentation](https://docs.convex.dev)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

## License

MIT

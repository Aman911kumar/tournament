# Battle4Arena OAuth (Capacitor) Setup

This repo implements a redirect-based OAuth flow designed to work in:

- Web (desktop + mobile browsers)
- Android APK (Capacitor WebView)
- Future Play Store signed builds

The flow avoids popup-based auth (which often breaks inside WebViews) by:

1. Opening the provider login in the system browser using `@capacitor/browser`
2. Redirecting back into the app via a deep link
3. Exchanging a short-lived one-time login code with the backend to receive JWTs

## 1) Frontend env

Set:

```env
VITE_APP_DEEPLINK_SCHEME="battle4arena"
VITE_API_BASE_URL="https://<your-backend-host>/api/v1"
```

The deep link used is:

`battle4arena://oauth/callback?code=...`

## 2) Backend env

On the backend:

- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_APP_ID` + `FACEBOOK_APP_SECRET`
- `APP_DEEPLINK_SCHEME=battle4arena`
- `OAUTH_ALLOWED_RETURN_SCHEMES=battle4arena`
- `OAUTH_ALLOWED_RETURN_ORIGINS=https://battle4arena.fun`

If your backend is behind a proxy / uses a different public host, set:

`API_PUBLIC_URL=https://<public-backend-host>`

## 3) Android deep link intent-filter (custom scheme)

In your Capacitor Android project, add an intent filter for the scheme inside the `<activity>` for `MainActivity`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="battle4arena" />
</intent-filter>
```

Capacitor listens for these links using the App plugin (`appUrlOpen`).

## 4) What to test

1. Web login from `https://battle4arena.fun/login`
2. Android debug APK login (deep link return)
3. Android release signed APK login (deep link return)

If the app opens but doesn't route correctly, confirm:

- The deep link listener is mounted (see `src/components/CapacitorUrlListener.tsx`)
- Your scheme matches `VITE_APP_DEEPLINK_SCHEME` and AndroidManifest


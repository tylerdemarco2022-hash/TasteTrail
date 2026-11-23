# Sign in with Google and Apple

Email sign-in keeps working. Google and Apple send an ID token to `POST /auth/oauth`. The server checks that token before it creates or links a TasteTrails account. Nothing in this file is a secret. Put the real IDs in `.env`, which is gitignored.

## Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project, or use the one that already has Places.
2. Configure the OAuth consent screen. Add the scopes `email`, `profile`, and `openid`.
3. Create an OAuth client ID of type **Web**. Copy the client ID. That value is both `VITE_GOOGLE_CLIENT_ID` and the first entry in `GOOGLE_OAUTH_CLIENT_IDS`.
4. Add the authorized JavaScript origins you use, including `http://localhost:5175` for local web and the production site origin.
5. Create an OAuth client ID of type **iOS**. Set the bundle ID to `com.tastetrails.app`. Append that client ID to `GOOGLE_OAUTH_CLIENT_IDS`, separated by a comma.
6. Do not put a client secret in the app or in git. The server only accepts ID tokens.

## Apple

App Store guideline 4.8 requires Sign in with Apple on iOS because Google sign-in is offered.

1. In the Apple Developer account, open the App ID `com.tastetrails.app` and enable **Sign in with Apple**.
2. Create a **Services ID** for the website, for example `com.tastetrails.web`. Enable Sign in with Apple on it and set the return URL to the same value as `VITE_APPLE_REDIRECT_URI` (the site origin plus `/` is enough for the popup flow).
3. Set `VITE_APPLE_CLIENT_ID` to that Services ID.
4. Set `APPLE_OAUTH_CLIENT_IDS` to the Services ID and `com.tastetrails.app`, separated by a comma. The iOS token audience is the bundle ID. The website token audience is the Services ID.
5. In Xcode, add the Sign in with Apple capability to the App target. In App Store Connect, the same capability must be on the app record.

## iOS plugins

The website uses Google Identity Services and Apple’s JavaScript SDK. The iOS shell uses the Capacitor plugins when they are installed:

```bash
npm install @capacitor/preferences @codetrix-studio/capacitor-google-auth @capacitor-community/apple-sign-in
npx cap sync ios
```

`@capacitor/preferences` stores the session on iOS. The web build falls back to `localStorage`. Sign out and account deletion remove that session.

In `capacitor.config.json`, the Google plugin needs the web client ID as `serverClientId` and the iOS client ID as `iosClientId`. Leave those empty in git and fill them on the machine that builds the app.

## What the server stores

A Google or Apple account is a normal TasteTrails user plus `{ provider, sub }`. The same email links to an existing email account. Sessions are written to `taste-trails/backend/data/sessions.json` (gitignored) with an access token and a refresh token. `POST /auth/refresh` issues a new access token. Deleting the account removes the user, the social graph, and every session for that user.

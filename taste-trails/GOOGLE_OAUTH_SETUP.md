# 🔐 Google OAuth Setup Guide

## Step 1️⃣: Create OAuth Client in Google Cloud Console

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/apis/credentials

2. **Create Project (if needed):**
   - Click "Select a project" → "New Project"
   - Name: `TasteTrails` (or your app name)
   - Click "Create"

3. **Enable Google+ API:**
   - Go to APIs & Services → Library
   - Search for "Google+ API"
   - Click "Enable"

4. **Configure OAuth Consent Screen:**
   - Go to APIs & Services → OAuth consent screen
   - User Type: **External** (for testing)
   - Click "Create"
   - Fill required fields:
     - App name: `TasteTrails`
     - User support email: your email
     - Developer contact email: your email
   - Click "Save and Continue"
   - Scopes: Skip (use defaults)
   - Test users: Add your email for testing
   - Click "Save and Continue"

5. **Create OAuth Client ID:**
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Web application** ⚠️ CRITICAL!
   - Name: `TasteTrails Backend`

6. **Add Authorized Redirect URIs:**
   ```
   http://localhost:8081/auth/google/callback
   ```
   ⚠️ No trailing slash!
   ⚠️ Must match your backend port exactly!

7. **Add Authorized JavaScript Origins:**
   ```
   http://localhost:5174
   http://localhost:8081
   ```
   ⚠️ No trailing slash!
   ⚠️ Must match your frontend port!

8. **Click "Create"**

9. **Copy Credentials:**
   - You'll see a popup with:
     - Client ID: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
     - Client Secret: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Keep this window open or download JSON

---

## Step 2️⃣: Update Your `.env` File

Open: `c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails\.env`

Replace these lines:
```env
# OLD (placeholder values):
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NEW (your actual values):
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **Important:**
- Client ID should be ~72 characters and end with `.apps.googleusercontent.com`
- Client Secret should start with `GOCSPX-` and be ~36 characters
- No quotes, no spaces, no trailing newlines

---

## Step 3️⃣: Restart Server

```powershell
# Kill existing server
taskkill /IM node.exe /F

# Restart
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
node server/index.js
```

**Look for this output:**
```
=== Google OAuth Configuration Check ===
1️⃣ Client ID loaded: YES
   - Length: 72
   - Ends with .apps.googleusercontent.com: ✅ YES
   - Is placeholder: ✅ No

2️⃣ Client Secret loaded: YES
   - Length: 36
   - Is placeholder: ✅ No

5️⃣ OAuth Enabled: ✅ YES
```

---

## Step 4️⃣: Test Google Login

1. Open frontend: http://localhost:5174
2. Click "Continue with Google"
3. Should redirect to Google login
4. After login, redirects back to your app

---

## 🚨 Common Errors & Fixes

### Error: "invalid_client"
**Causes:**
- Placeholder values still in `.env`
- Wrong OAuth client type (Android/iOS instead of Web)
- Typo in Client ID or Secret

**Fix:**
- Verify credentials from Google Cloud Console
- Ensure OAuth client type is "Web application"
- Copy/paste carefully (no extra spaces)

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI in Google Cloud doesn't match backend

**Fix:**
- Google Cloud Console → Credentials → Edit OAuth Client
- Add: `http://localhost:8081/auth/google/callback`
- Save and wait 5 minutes for propagation

### Error: "Access blocked: This app's request is invalid"
**Cause:** Authorized JavaScript Origins not configured

**Fix:**
- Add `http://localhost:5174` to Authorized JavaScript Origins
- Add `http://localhost:8081` as well
- Save and retry

---

## 📋 Verification Checklist

Before testing, confirm:

- [ ] Google Cloud Project created
- [ ] OAuth consent screen configured
- [ ] OAuth Client ID type is **Web application**
- [ ] Authorized Redirect URI: `http://localhost:8081/auth/google/callback`
- [ ] Authorized JavaScript Origins: `http://localhost:5174` and `http://localhost:8081`
- [ ] Client ID ends with `.apps.googleusercontent.com`
- [ ] Client Secret starts with `GOCSPX-`
- [ ] `.env` file updated with real credentials
- [ ] Server restarted
- [ ] Diagnostic log shows "✅ YES" for all checks

---

## 🔐 Security Notes

**For Development:**
- `http://localhost` is fine for testing
- OAuth consent screen can be "External" in testing mode

**For Production:**
- Change redirect URIs to your production domain with HTTPS
- Add production domain to Authorized JavaScript Origins
- Update `.env` with production URLs
- Verify OAuth consent screen for production use

---

## 🆘 Still Having Issues?

1. **Check server startup log:**
   ```powershell
   Get-Content "server-startup.log"
   ```

2. **Verify environment variables loaded:**
   Look for the diagnostic output in server logs

3. **Check Google Cloud Console:**
   - Ensure OAuth client is "Enabled"
   - Check if any restrictions are applied

4. **Clear browser cache:**
   - Old OAuth tokens may be cached
   - Try incognito mode

5. **Wait 5 minutes:**
   - Google Cloud changes can take time to propagate

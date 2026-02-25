# Mobile App Setup Guide

## ✅ What I've Done

Your web app has been configured as an **Expo mobile app**. Here's what was set up:

### Files Created/Modified:

1. **`app.json`** - Expo configuration with iOS/Android settings
2. **`App.js`** - Mobile app entry point using React Navigation
3. **`babel.config.js`** - Babel configuration for Expo
4. **`metro.config.js`** - Metro bundler configuration
5. **`eas.json`** - Build configuration for app stores
6. **`.gitignore`** - Added mobile build artifacts
7. **`package.json`** - Added mobile scripts (`start`, `ios`, `android`, `web`)

## 📱 Running Your App

### Option 1: Development Mode (Expo Go - Easiest)

```bash
# Start the Expo development server
npm start

# Then:
# - Press 'i' for iOS simulator (requires Xcode on Mac)
# - Press 'a' for Android emulator (requires Android Studio)
# - Scan QR code with Expo Go app on your phone
```

### Option 2: Web Version (Keep using Vite)

```bash
# Your existing web app still works
npm run dev
```

## ⚠️ Important Next Steps

### 1. Convert Components to React Native

Your current components use HTML/CSS which won't work in React Native. You need to convert:

**❌ Web (doesn't work in mobile):**
```jsx
<div className="container">
  <button onClick={handleClick}>Click</button>
</div>
```

**✅ React Native (works on mobile):**
```jsx
import { View, TouchableOpacity, Text } from 'react-native';

<View style={styles.container}>
  <TouchableOpacity onPress={handleClick}>
    <Text>Click</Text>
  </TouchableOpacity>
</View>
```

### 2. Replace CSS with StyleSheet

**❌ Web:**
```css
.container {
  padding: 20px;
  background: #fff;
}
```

**✅ React Native:**
```jsx
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff'
  }
});
```

### 3. Install Missing Dependencies

```bash
npm install expo-status-bar --legacy-peer-deps
npm install expo-constants expo-linking --legacy-peer-deps
```

### 4. Update API Calls for Mobile

In your `.env` or config, change:
```env
# From localhost (only works on your computer)
VITE_API_BASE_URL=http://localhost:8081

# To your computer's IP (works on phone)
VITE_API_BASE_URL=http://192.168.1.XXX:8081
# Or deploy backend to cloud
VITE_API_BASE_URL=https://your-backend.railway.app
```

### 5. Create App Icons

You need these image files in `/public`:
- `icon.png` - 1024x1024px
- `splash.png` - 1284x2778px
- `favicon.ico` - 32x32px

Use a tool like: https://www.appicon.co

## 🚀 Building for App Stores

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure Your Project
```bash
eas build:configure
```

### Step 3: Build for iOS
```bash
# Requires Apple Developer Account ($99/year)
eas build --platform ios
```

### Step 4: Build for Android
```bash
# Free - just need Google account
eas build --platform android
```

### Step 5: Submit to Stores
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

## 📋 Checklist Before Submitting

- [ ] Convert all components from HTML to React Native
- [ ] Replace Tailwind CSS with StyleSheet
- [ ] Test on actual iOS/Android devices
- [ ] Create app icons (1024x1024)
- [ ] Create splash screen (1284x2778)
- [ ] Write privacy policy (required by Apple)
- [ ] Configure environment variables for production
- [ ] Test authentication flow on mobile
- [ ] Test all navigation
- [ ] Register for Apple Developer ($99/year)
- [ ] Register for Google Play Developer ($25 one-time)

## 🆘 Common Issues

### "Cannot find module 'babel-preset-expo'"
```bash
npm install --save-dev babel-preset-expo --legacy-peer-deps
```

### "Unsupported Node version"
Your Node 20.19.0 is slightly old. Update to 20.19.4+:
```bash
nvm install 20.19.4
nvm use 20.19.4
```

### "Network request failed" on phone
Your backend is on localhost. Use your computer's IP:
```bash
# Find your IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# Update .env
VITE_API_BASE_URL=http://YOUR_IP:8081
```

## 🎯 Current Status

**✅ Setup Complete:**
- Expo configuration files created
- React Navigation installed
- Build system configured
- Scripts ready to use

**❌ Not Yet Done:**
- Components not converted to React Native (still using HTML/CSS)
- No app icons created
- Backend still on localhost (won't work on phone)
- No Apple/Google Developer accounts

**Estimated time to finish:** 2-4 weeks of development

## 💡 Recommendation

Since converting the entire app to React Native is significant work, consider:

1. **Start Small**: Convert one screen (e.g., Login) to React Native first
2. **Use Expo Go**: Test quickly without building full app
3. **Deploy Backend First**: Get backend on Railway/Render so phone can access it
4. **Hybrid Approach**: Keep web version on Vite, mobile on Expo separately

Need help with the conversion? Let me know which component to start with!

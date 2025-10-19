# SkateConnect - Capacitor Setup Guide

## Prerequisites

- Node.js 18+ and npm installed
- For iOS: macOS with Xcode 14+ installed
- For Android: Android Studio installed with Android SDK

## Initial Setup

### 1. Install Dependencies

First, install all project dependencies:

```bash
npm install
```

### 2. Install Capacitor Packages (for native builds only)

The application currently runs as a web app. To enable native iOS and Android features, install Capacitor:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/camera @capacitor/geolocation @capacitor/push-notifications @capacitor/android @capacitor/ios
```

After installing Capacitor, update `src/lib/capacitor.ts` to import from the actual packages instead of using the web fallbacks.

### 3. Build the Web App

```bash
npm run build
```

### 4. Initialize Capacitor (First Time Only)

Capacitor has already been configured in `capacitor.config.ts`. The configuration includes:
- App ID: `com.skateconnect.app`
- App Name: `SkateConnect`
- Web directory: `dist`

### 4. Add Native Platforms

#### Add iOS (macOS only)

```bash
npm run cap:add:ios
```

#### Add Android

```bash
npm run cap:add:android
```

## Development Workflow

### Building and Syncing

After making changes to your web code, you need to build and sync:

```bash
npm run cap:sync
```

This command:
1. Builds the web app (`npm run build`)
2. Copies web assets to native projects
3. Updates native dependencies

### Opening Native IDEs

#### Open Xcode (iOS)

```bash
npm run cap:open:ios
```

or use the shortcut:

```bash
npm run ios
```

#### Open Android Studio (Android)

```bash
npm run cap:open:android
```

or use the shortcut:

```bash
npm run android
```

## Testing on Devices

### iOS

1. Connect your iPhone via USB
2. Open the project in Xcode: `npm run ios`
3. Select your device from the device dropdown
4. Click the Run button (or press Cmd+R)
5. Trust the developer certificate on your device if prompted

### Android

1. Enable Developer Mode on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Enable USB Debugging in Developer Options

2. Connect your device via USB
3. Open the project in Android Studio: `npm run android`
4. Select your device from the device dropdown
5. Click the Run button

## Storage Buckets Configuration

SkateConnect uses Supabase Storage with the following buckets:

- `avatars` - User profile pictures
- `covers` - Profile cover photos
- `posts` - Post media (photos/videos)
- `spots` - Spot photos/videos
- `challenges` - Challenge submission media
- `messages` - Message attachments

### Creating Storage Buckets

1. Go to your Supabase project dashboard
2. Navigate to Storage
3. Create the following public buckets:
   - avatars (10MB max file size)
   - covers (10MB max file size)
   - posts (50MB max file size)
   - spots (50MB max file size)
   - challenges (50MB max file size)
   - messages (10MB max file size)

### Storage Policies

For each bucket, configure the following RLS policies:

**Public Read Policy:**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bucket_name');
```

**Authenticated Upload Policy:**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bucket_name');
```

**Users can update own files:**
```sql
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
```

## Push Notifications Setup

### Firebase Setup for Android

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Add an Android app with package name: `com.skateconnect.app`
4. Download `google-services.json`
5. Place it in `android/app/` directory

### Apple Push Notifications (iOS)

1. Go to [Apple Developer Account](https://developer.apple.com/)
2. Create an App ID with Push Notifications enabled
3. Create a Push Notification certificate
4. Configure in Xcode:
   - Select your target
   - Enable Push Notifications capability
   - Sign with your team

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_TOKEN=your_mapbox_token
```

## Building for Production

### iOS App Store Build

1. Open Xcode: `npm run ios`
2. Select "Any iOS Device" as target
3. Product > Archive
4. Follow the App Store submission process

### Android Play Store Build

1. Generate a keystore:
```bash
keytool -genkey -v -keystore skateconnect.keystore -alias skateconnect -keyalg RSA -keysize 2048 -validity 10000
```

2. Configure signing in `android/app/build.gradle`

3. Build release APK:
```bash
cd android
./gradlew assembleRelease
```

4. The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Troubleshooting

### iOS Issues

**Problem:** "Could not find module 'Capacitor'"
**Solution:** Run `npm run cap:sync` to update native dependencies

**Problem:** Signing errors
**Solution:** Configure signing in Xcode under Signing & Capabilities

### Android Issues

**Problem:** Gradle build fails
**Solution:** Update Android Studio and sync Gradle files

**Problem:** SDK not found
**Solution:** Set `ANDROID_HOME` environment variable to your SDK location

### General Issues

**Problem:** White screen on app launch
**Solution:**
1. Check that `npm run build` completes successfully
2. Verify `capacitor.config.ts` has `webDir: 'dist'`
3. Run `npm run cap:sync` again

**Problem:** Plugins not working
**Solution:**
1. Check plugin is installed: `npm list @capacitor/plugin-name`
2. Sync native projects: `npm run cap:sync`
3. Clean and rebuild native projects

## Useful Commands

```bash
# Check Capacitor installation
npx cap doctor

# Update Capacitor
npm install @capacitor/core@latest @capacitor/cli@latest

# Update all plugins
npm update @capacitor/camera @capacitor/geolocation @capacitor/push-notifications

# Clean iOS build
cd ios && pod install && cd ..

# Clean Android build
cd android && ./gradlew clean && cd ..
```

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS App Store Submission Guide](https://developer.apple.com/app-store/submissions/)
- [Android Play Store Submission Guide](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)

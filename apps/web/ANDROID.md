# Android APK build (Capacitor 7)

## Requirements

| Tool | Version | Notes |
|------|---------|--------|
| Node.js | 20+ | |
| **JDK** | **17** (preferred) or 21 | Full JDK with `javac` — JRE-only installs fail Gradle |
| Android SDK | API **35** | `platforms;android-35`, `build-tools;35.0.0`, `platform-tools` |
| Gradle | 8.11.1 | Via project wrapper (`./gradlew`) |
| AGP | 8.7.2 | In `android/build.gradle` |
| RAM | **≥4 GB free** | `next build` (static export) is memory-heavy |

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo /usr/lib/jvm/java-17-openjdk-amd64)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

`android/local.properties` (gitignored):

```properties
sdk.dir=/absolute/path/to/Android/Sdk
```

## UI / product notes (NSFW roleplay mobile)

Aligned with patterns from mobile AI RP clients (dark chrome, safe-area, large touch targets):

- Dark `#0a0a0a` background + splash
- `viewport-fit=cover` + `env(safe-area-inset-*)` for notches/gesture bars
- Minimum ~44px touch targets
- Adult content gated by API login + DOB/consent (`requireAdultConsent`)
- Sex game: explicit EN/BN narrative, language selector on start

## Workable debug APK (sideload)

```bash
cd apps/web
cp .env.production.example .env.production
# REQUIRED — URL is inlined at next build time:
#   Emulator:  http://10.0.2.2:3001
#   Phone LAN: http://192.168.x.x:3001   (API must bind 0.0.0.0)
#   Prod:      https://api.yourdomain.com
# Never use http://localhost inside an APK (that is the phone itself).

npm install
npm run android:apk
# = next build + cap sync + ./gradlew assembleDebug
```

Artifact:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Release APK (signed)

1. Create `android/keystore.properties` + keystore (do not commit).
2. `npm run android:apk:release`
3. Output: `android/app/build/outputs/apk/release/app-release.apk`

Without a keystore, release builds may be unsigned and fail install on modern Android — use **debug** for testing.

## Common failures

| Symptom | Fix |
|---------|-----|
| `SDK location not found` | `sdk.dir` in `android/local.properties` or `ANDROID_HOME` |
| `compileSdk 35 not found` | `sdkmanager "platforms;android-35" "build-tools;35.0.0"` |
| `JAVA_COMPILER` / toolchain | Install **JDK 17**, set `JAVA_HOME` (not JRE) |
| `next build` killed / OOM | Free ≥4 GB RAM; close other apps |
| Missing `NEXT_PUBLIC_API_URL` | Create `.env.production` before `cap:sync` |
| Blank app / network errors | Wrong API host; rebuild after changing env |
| Cleartext blocked | Dev APK allows cleartext; prod should use HTTPS |
| Permission denials | App only needs INTERNET + optional READ_MEDIA_IMAGES |

## App config (current)

- `applicationId` / namespace: `com.storybook.studio`
- `minSdk` 24 · `targetSdk` / `compileSdk` 35
- `versionName` 1.1.0 · `versionCode` 2
- Capacitor `webDir`: `out` (Next `output: "export"`)
- Cleartext HTTP allowed for LAN/emulator testing

## API for phone testing

```bash
# API must accept connections from the phone, not only loopback
# Ensure server host 0.0.0.0 and CORS allows the Capacitor origin
```

## Static export optimization

`next.config.mjs` uses `output: "export"` → artifacts in `out/` (Capacitor `webDir`).

| Setting | Why |
|---------|-----|
| `images.unoptimized` | No image optimizer server in APK |
| `trailingSlash: true` | Reliable paths in WebView |
| `optimizePackageImports` | Smaller JS for react-icons / date-fns / etc. |
| `compiler.removeConsole` | Strip `console.log` from production APK |
| `eslint.ignoreDuringBuilds` | Faster / lower-memory CI builds |
| `NODE_OPTIONS=--max-old-space-size=4096` | Avoid OOM on `next build` |

Low-RAM machines:

```bash
npm run build:lowmem
```


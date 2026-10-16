# Mus'haf for Android

The Android app packages the existing Albanian Quran reader with Capacitor. All **604 Quran pages and their QCF V2 Arabic fonts** are included, so reading works offline after installation. The website remains available unchanged on `main`.

## Features

- Original Arabic page data and calligraphy preserved from the website.
- Albanian navigation, animated opening, smooth page turns and fast page/surah jumps.
- Native Android Back navigation, system bar themes and safe area handling.
- Reading position, bookmarks and night mode saved independently on each device. Reopening the app automatically resumes the saved page, including after a cold start.
- Albanian loading screen stays visible until preferences and the saved reading page are ready; respects night mode and reduced motion.
- External HTTPS links open in a browser tab. No analytics is loaded inside the Android app.

## Build locally

Install Node.js 24, Java 21 and a current Android Studio with Android SDK 36, Build Tools 36.0.0 and Platform Tools. Set `ANDROID_HOME` to your SDK directory and `JAVA_HOME` to Java 21.

```sh
npm ci
npm run android:apk
```

The first build downloads the remaining Arabic fonts from the same pinned Quran.com font revision used by the website. Later builds reuse the local font cache. Generated files and downloaded fonts are excluded from Git.

The installable debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Transfer it to your Android phone and allow installation from the app used to open the APK when Android prompts you. Debug builds are for testing.

To open the project in Android Studio:

```sh
npm run android:sync
npm run android:open
```

Minimum supported Android version: **Android 7.0 / API 24**. Application ID: `com.samimustafa.mushaf`.

## Release and Google Play

Use Android Studio → Build → Generate Signed App Bundle / APK to create an Android App Bundle with your own signing key. Keep that key private and backed up; never commit it. `npm run android:bundle` builds an unsigned release bundle for a separately configured signing workflow. A Play Store release also needs your developer account, listing, privacy disclosures and device testing.

## Validation

`npm run android:sync` checks the Quran content, packages native assets and verifies all 604 local fonts, unchanged page JSON, native navigation and preference restoration. Test the resulting APK on physical Android devices before distributing a release, including airplane mode, opening the book, swiping, page/surah jumps, saved progress, dark mode and Android Back.

Created by **[Sami Mustafa](https://github.com/samimustafaa)**.

## Automatic live updates

Version 1.0.2 adds the open-source Capgo updater in manual mode. Update files are hosted in this repository's `android-ota` GitHub prerelease; no Capgo account, paid subscription, API key or Capgo telemetry is used.

After the reader starts successfully, the app checks the public update manifest. A file manifest with SHA-256 checksums lets the native updater copy unchanged files from the APK/cache, including all Quran pages and Arabic fonts, and download changed files. Updates stage in the background and activate when the app is backgrounded or restarted. The reader is never forcibly reloaded during an active reading session. Native Preferences keep the saved page, bookmarks and theme across web bundle changes.

The native watchdog waits up to 60 seconds for the startup-ready signal. If the new web bundle cannot initialize, Capgo rolls back to the previous working bundle. This is startup failure recovery, not a guarantee against every later application bug. Offline or interrupted downloads leave the current reader available; a future foreground/online event retries. A failed version is skipped rather than installed repeatedly.

### Publishing

Push to `feature/android-app`, or use Actions → Android APK → Run workflow on that branch. The workflow checks update behavior and Quran content, builds the APK, prepares verified delta files, uploads generated assets and publishes `android-update.json` last. Only successful builds publish. `main` is untouched.

The manifest binds an update to an exact Android versionName/versionCode. If Android native files, Capacitor config or native plugin versions change, increase both native version fields; the publisher refuses a changed native fingerprint under the same version. Existing phones ignore incompatible updates and need a new APK for those native changes. New users must install the updater-enabled APK once.

For a deliberate rollback of a published web change, revert the web change on the Android branch and push again. The new workflow run publishes a higher sequence with the restored code. Do not lower the manifest sequence or replace hashed assets manually.

GitHub hosts the channel subject to its availability and service limits. The generated manifest is public and contains no user reading progress. It trusts this repository over HTTPS and verifies individual file hashes. Keep repository write access secure.

### Signing test builds

GitHub-hosted debug APKs use temporary debug keys and are intended for testing. Before wider distribution, configure a durable signing key and keep it private. APKs signed with different keys cannot update an existing installation; do not uninstall an older test app before noting the reading page and bookmarks you want to retain. Live web updates do not change the installed APK's signature.

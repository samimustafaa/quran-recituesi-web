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

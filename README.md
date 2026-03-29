# find-my-park

## Android Google Maps key setup (Expo)

Use one canonical environment variable name everywhere:

- `EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY`

### 1) Set the env var

In your shell (or `.env` that Expo loads), set:

```bash
export EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY=your_google_maps_android_key
```

If you use EAS build profiles, also set `EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY` in your build environment/secrets.

### 2) Rebuild your native client

Android map keys are compiled into native config, so you must rebuild after changing the key:

```bash
npx expo run:android
```

Or rebuild with EAS if you use cloud builds.

> Note: Expo Go cannot load your custom native Android Google Maps key. Use a custom dev client or a standalone build.

### 3) Verify in-app

1. Launch the rebuilt app.
2. Open the **Navigate** tab.
3. Confirm the map warning card does **not** show a missing key warning.
4. If it appears, check the inline status in that card for:
   - Runtime (`Expo Go` vs `Custom dev client / standalone`)
   - Key detection (`EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY: Yes/No`)

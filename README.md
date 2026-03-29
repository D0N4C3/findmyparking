# find-my-park

## Google Maps setup (Expo + react-native-maps)

This project uses `react-native-maps` with the Google provider for iOS and Android.

Use these canonical environment variables:

- `EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY`
- `EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY`

### 1) Add keys

In your shell or `.env`:

```bash
export EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY=your_android_google_maps_key
export EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY=your_ios_google_maps_key
```

If you use EAS, add both to your build profile environment/secrets.

### 2) Rebuild native app

Map keys are injected at native build time.

```bash
npx expo run:android
npx expo run:ios
```

> Expo Go cannot load custom native Google map keys. Use a dev client or a standalone build.

### 3) Verify Navigation screen flow

1. Open **Navigate** tab.
2. Confirm the map renders.
3. Use **Build Route** to generate an in-app route to your parked car.
4. Check setup card status if map does not render:
   - Android key detection (`EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY`)
   - iOS key detection (`EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY`)

const { expo } = require('./app.json');

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      config: {
        ...(expo.android?.config ?? {}),
        googleMaps: {
          ...((expo.android?.config && expo.android.config.googleMaps) ?? {}),
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_GEO_API_KEY,
        },
      },
    },
    ios: {
      ...expo.ios,
      config: {
        ...(expo.ios?.config ?? {}),
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_IOS_GEO_API_KEY,
      },
    },
  },
};

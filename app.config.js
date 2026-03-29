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
          apiKey: process.env.GOOGLE_ANDROID_GEO_API_KEY,
        },
      },
    },
  },
};

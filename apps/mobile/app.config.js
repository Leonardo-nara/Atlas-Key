module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // EAS file environment variable; never commit the Firebase configuration.
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {})
  }
});

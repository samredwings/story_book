import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.storybook.studio",
  appName: "Storybook Studio",
  webDir: "out",
  server: {
    androidScheme: "https",
    // Allow navigation to API host if needed for OAuth-style redirects
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#0a0a0a",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
  },
};

export default config;

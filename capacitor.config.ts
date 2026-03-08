import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gasfacilpro.app',
  appName: 'GásFacilPro Entregador',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    BackgroundGeolocation: {
      locationProvider: 1,
    }
  }
};

export default config;

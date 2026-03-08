import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gasfacilpro.app',
  appName: 'GásFacilPro Entregador',
  webDir: 'dist',
  server: {
    url: 'https://entregador.gasfacilpro.com.br',
    cleartext: true
  },
  plugins: {
    BackgroundGeolocation: {
      locationProvider: 1,
    }
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hisoka.offline',
  appName: 'Hisoka',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    CapacitorHttp: { enabled: false },
    CapacitorCookies: { enabled: false },
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;

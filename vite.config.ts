import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Android WebView always supports WOFF2, so the WOFF/TTF fallbacks from @fontsource and KaTeX only bloat the APK. */
function woff2Only(): Plugin {
  return {
    name: 'hisoka-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/(@fontsource[\\/].+|katex[\\/]dist[\\/]katex(\.min)?)\.css$/.test(id)) return null;
      return code.replace(/,\s*url\([^)]+\.(woff|ttf)\)\s*format\(['"](woff|truetype)['"]\)/g, '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [woff2Only(), react()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
});

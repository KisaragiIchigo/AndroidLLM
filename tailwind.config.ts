import type { Config } from 'tailwindcss';

/** Tokens mirror project_style.json. Add colors there first, then here. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0e0f11',
          deep: '#09090b',
          surface: '#16181b',
          raised: '#1c1f23',
        },
        paper: {
          DEFAULT: '#e8e2d6',
          muted: '#a8a196',
        },
        lamp: {
          DEFAULT: '#e2b25c',
          hi: '#f0cd8a',
          light: '#e9be6c',
          deep: '#c9933f',
          ink: '#1a1408',
        },
        verdigris: {
          DEFAULT: '#7fa8a1',
          text: '#b6d2cc',
        },
        sealed: {
          DEFAULT: '#8fbf8a',
          text: '#c4e2bf',
        },
        ember: {
          DEFAULT: '#e07a6b',
          text: '#efb0a6',
          soft: '#e9a79c',
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"IBM Plex Sans JP"', 'sans-serif'],
        sans: ['"IBM Plex Sans JP"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"IBM Plex Sans JP"', 'monospace'],
      },
      fontSize: {
        body: ['clamp(15px, 3.9vw, 17px)', { lineHeight: '1.75', letterSpacing: '0.01em' }],
      },
      boxShadow: {
        lamp: '0 0 18px rgba(226, 178, 92, 0.16)',
        'lamp-strong': '0 0 14px rgba(226, 178, 92, 0.4)',
        inset: 'inset 0 1px 2px rgba(0, 0, 0, 0.55)',
        sheet: '0 -20px 50px rgba(0, 0, 0, 0.5)',
      },
      zIndex: {
        floating: '40',
        modal: '50',
        tooltip: '60',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        breathe: 'breathe 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

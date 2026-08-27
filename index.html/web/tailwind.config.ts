import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#030305',
        quantum: '#0f1016',
        accent: '#d4af37',
        neon: '#00f3ff',
      },
      fontFamily: {
        sans: ['var(--font-jetbrains-mono)', 'monospace'],
        serif: ['var(--font-cinzel)', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0b0d12', 2: '#12151d', 3: '#1a1e29', line: '#262b38' },
        gold: { DEFAULT: '#d4a843', soft: '#e9cf8a' },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#0b0a08',
          soft: '#141210',
          card: '#1a1713',
          line: '#2c2620',
        },
        brown: {
          deep: '#2e2014',
          mid: '#4a3522',
        },
        ivory: {
          DEFAULT: '#f4efe6',
          dim: '#b8b0a2',
          faint: '#7d766a',
        },
        gold: {
          DEFAULT: '#c9a24b',
          bright: '#e0bd6a',
          dim: '#8a6f33',
        },
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        body: ['-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

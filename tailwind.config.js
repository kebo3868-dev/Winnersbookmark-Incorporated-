/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wb: {
          black:    '#0a0a0f',
          dark:     '#111827',
          card:     '#1a1f2e',
          border:   '#1e2d4a',
          blue:     '#2563eb',
          'blue-light': '#3b82f6',
          'blue-glow':  '#60a5fa',
          'blue-muted': '#1e3a5f',
          white:    '#f9fafb',
          muted:    '#94a3b8',
          gold:     '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'blue-glow': '0 0 20px rgba(37, 99, 235, 0.3)',
        'blue-glow-lg': '0 0 40px rgba(37, 99, 235, 0.4)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

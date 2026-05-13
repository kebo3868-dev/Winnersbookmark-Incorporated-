/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          black:   '#05060d',
          deep:    '#080b18',
          navy:    '#0c1226',
          panel:   '#0f1631',
          card:    '#111a36',
          card2:   '#0b1126',
          line:    '#1c2547',
          edge:    '#243264',
        },
        electric: {
          DEFAULT: '#3b82f6',
          deep:    '#1d4ed8',
          glow:    '#60a5fa',
          muted:   '#1e3a8a',
        },
        gold: {
          DEFAULT: '#d4af37',
          light:   '#f5d061',
          deep:    '#a67c00',
          muted:   '#3a2f11',
        },
        paper:  '#f5f6fb',
        chalk:  '#cbd2e0',
        mist:   '#8893ad',
        ghost:  '#5a667f',
        danger: '#ef4444',
        success:'#10b981',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        comic:   ['"Bebas Neue"', 'Impact', 'sans-serif'],
      },
      boxShadow: {
        'gold':        '0 0 24px rgba(212,175,55,0.28)',
        'gold-lg':     '0 0 48px rgba(212,175,55,0.35)',
        'electric':    '0 0 24px rgba(59,130,246,0.35)',
        'electric-lg': '0 0 48px rgba(59,130,246,0.5)',
        'panel':       '0 12px 40px rgba(0,0,0,0.65)',
        'panel-lg':    '0 20px 60px rgba(0,0,0,0.75)',
        'inset-edge':  'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'noir':        'radial-gradient(1200px 600px at 10% -10%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(212,175,55,0.10), transparent 60%), linear-gradient(180deg, #05060d 0%, #080b18 100%)',
        'gold-line':   'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.6) 50%, transparent 100%)',
        'panel-glass': 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      },
      animation: {
        'fade-in':  'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

import type { Config } from 'tailwindcss';

/**
 * WINNERS BOOKMARK INCORPORATED — BRAND SYSTEM
 *
 * Three colours, and only three: black for depth, electric blue for action,
 * white for clarity. The brief asked for a site a restaurant owner or an
 * executive would believe belongs to a serious AI company, and the fastest way
 * to lose that is a fourth accent colour.
 *
 * Note what is deliberately ABSENT: the gold used by the Restaurant Rescue
 * Agent's internal console, and the gold/electric mix used by the Daily Blogs
 * app. Those are separate products with separate audiences. The marketing site
 * does not inherit either palette.
 *
 * Blue is rationed. It marks the thing you should click, the data that matters,
 * and nothing else. A page where everything glows is a page where nothing does.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Black, in layers. Depth comes from stacking these, never from a
        // decorative gradient.
        night: {
          DEFAULT: '#05070d', // page ground
          soft: '#0a0d16',    // raised surface
          card: '#0f131f',    // card fill
          line: '#1b2130',    // hairline borders
          edge: '#2a3348',    // emphasised border / focus ring track
        },
        // Electric blue. `DEFAULT` is the CTA; `bright` is hover; `deep` is the
        // pressed/darker variant; `haze` is for large translucent washes only.
        electric: {
          DEFAULT: '#2563eb',
          bright: '#3b82f6',
          light: '#60a5fa',
          deep: '#1d4ed8',
          haze: '#0d2350',
        },
        // White, in layers, for readable hierarchy on black.
        snow: {
          DEFAULT: '#ffffff',
          soft: '#e8ecf4', // body copy
          dim: '#a8b2c4',  // secondary copy
          faint: '#6b7688', // labels, metadata
        },
        // Status colours for the LIVE / IN DEVELOPMENT / COMING SOON system.
        // Not brand colours — they carry meaning, so they sit outside the
        // three-colour rule on purpose and are used nowhere else.
        status: {
          live: '#34d399',
          building: '#fbbf24',
          planned: '#8b93a7',
        },
      },
      fontFamily: {
        // System stack. No webfont request on first paint, which protects
        // Largest Contentful Paint and removes a layout-shift source.
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter',
          'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // A display ramp that stays readable on a 320px phone. `clamp` means
        // no breakpoint-by-breakpoint font overrides scattered through markup.
        'display-xl': ['clamp(2.5rem, 7vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2rem, 5.5vw, 3.5rem)', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        'display-md': ['clamp(1.65rem, 4vw, 2.5rem)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-sm': ['clamp(1.35rem, 3vw, 1.75rem)', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
      },
      maxWidth: {
        prose: '68ch',
      },
      boxShadow: {
        // One glow, used sparingly on primary actions only.
        action: '0 6px 24px -6px rgba(37, 99, 235, 0.55)',
        lift: '0 18px 48px -24px rgba(0, 0, 0, 0.9)',
      },
      animation: {
        'rise': 'rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

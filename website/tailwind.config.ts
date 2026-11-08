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
        // Two families, self-hosted at build time by next/font (no runtime
        // request to a font CDN, no layout shift: metrics-matched fallbacks).
        //  - Display: Instrument Serif. Headlines only. An editorial serif is
        //    what separates "a serious firm" from "another AI landing page" at a
        //    glance, and it is the only typographic flourish in the system.
        //  - Sans: Inter. Everything a visitor has to read or act on.
        sans: [
          'var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        display: ['var(--font-display)', 'Iowan Old Style', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // A display ramp that stays readable on a 320px phone. `clamp` means
        // no breakpoint-by-breakpoint font overrides scattered through markup.
        // The serif runs larger and tighter than a sans would at the same rank.
        'display-xl': ['clamp(2.9rem, 8.2vw, 6rem)', { lineHeight: '0.98', letterSpacing: '-0.025em' }],
        'display-lg': ['clamp(2.4rem, 6vw, 4.25rem)', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(2rem, 4.6vw, 3.25rem)', { lineHeight: '1.06', letterSpacing: '-0.018em' }],
        'display-sm': ['clamp(1.3rem, 2.6vw, 1.6rem)', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
      },
      maxWidth: {
        prose: '68ch',
      },
      boxShadow: {
        // One glow, used sparingly on primary actions only.
        action: 'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 28px -8px rgba(37, 99, 235, 0.7)',
        // Hairline highlight along the top edge of a surface: reads as a lit
        // edge on black, which is where "premium" comes from on a dark site.
        edge: 'inset 0 1px 0 rgba(255, 255, 255, 0.045)',
        lift: '0 18px 48px -24px rgba(0, 0, 0, 0.9)',
      },
      animation: {
        'rise': 'rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'rise-late': 'rise 0.7s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-dot': 'pulseDot 2.4s ease-in-out infinite',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { boxShadow: '0 0 0 0 currentColor' },
          '50%': { boxShadow: '0 0 0 4px transparent' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

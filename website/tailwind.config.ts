import type { Config } from 'tailwindcss';

/**
 * WINNERS BOOKMARK INCORPORATED — DESIGN SYSTEM
 *
 * The brief for this revision: a restaurant owner should look at this for ten
 * seconds and see a serious technology company, not someone experimenting with
 * AI. Three things carry that, and none of them is decoration.
 *
 * 1. SURFACE DEPTH. A single flat black is the signature of a template. Real
 *    interfaces are built in layers, and the eye reads that layering as
 *    structure. Six ink levels below, each ~2-4% apart in luminance, so
 *    stacking two of them reads as intentional rather than accidental.
 *
 * 2. TYPOGRAPHY AS THE DOMINANT ELEMENT. The display ramp is fluid and much
 *    larger at the top end than the previous revision, with negative tracking
 *    that tightens as size grows — the way editorial type actually behaves.
 *
 * 3. RATIONED COLOUR. Cobalt is a signal, not a theme. It marks live system
 *    activity, data, and the one action worth taking. A page where everything
 *    glows is a page where nothing does — and glow-everywhere is precisely the
 *    crypto/cyberpunk register the brief rules out.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * INK — the surface stack, darkest to lightest.
         * `void` is the page ground. Each step up is a raised plane.
         * Hues carry a faint blue bias (not neutral grey) so the dark reads as
         * deep midnight rather than switched-off.
         */
        ink: {
          void: '#04060c',
          base: '#070a12',
          raised: '#0b0f1a',
          panel: '#0f1421',
          elevated: '#141b2b',
          line: '#1c2437',
          border: '#28324a',
          steel: '#39465f',
        },
        /**
         * COBALT — the signal colour. `core` is the CTA and the only large
         * solid fill of it on any page.
         */
        cobalt: {
          deep: '#1533a8',
          core: '#2454eb',
          bright: '#3b74ff',
          light: '#6a9bff',
          pale: '#a9c6ff',
          wash: '#0d1c44',
        },
        /** TEXT — a four-stop ramp on dark. */
        text: {
          bright: '#ffffff',
          primary: '#e6ebf5',
          secondary: '#9aa7bd',
          muted: '#6b7893',
          faint: '#4b5670',
        },
        /** SIGNAL — meaning-bearing states. Deliberately outside the brand
         *  palette and used nowhere decorative. */
        signal: {
          live: '#2dd4a7',
          building: '#f0b429',
          planned: '#5c6880',
          loss: '#f2585b',
        },
      },

      fontFamily: {
        // Bound to the CSS variable that next/font sets. Self-hosted at build
        // time: no external request, no FOUT, no layout shift.
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      /**
       * Fluid display ramp. `clamp` means one class works from 320px to 1920px
       * with no breakpoint overrides scattered through markup — and the mobile
       * floor is set deliberately high enough to stay commanding but low enough
       * that a headline never becomes six cramped lines on a 360px phone.
       */
      fontSize: {
        'hero': ['clamp(2.5rem, 5.3vw, 4.75rem)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '700' }],
        'display-1': ['clamp(2.25rem, 4.8vw, 4rem)', { lineHeight: '1.04', letterSpacing: '-0.032em', fontWeight: '700' }],
        'display-2': ['clamp(1.875rem, 3.4vw, 2.875rem)', { lineHeight: '1.1', letterSpacing: '-0.026em', fontWeight: '650' }],
        'display-3': ['clamp(1.375rem, 2.2vw, 1.875rem)', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '620' }],
        'title': ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.012em', fontWeight: '600' }],
        'lede': ['clamp(1.0625rem, 1.35vw, 1.3125rem)', { lineHeight: '1.62', letterSpacing: '-0.011em' }],
        'body': ['0.9375rem', { lineHeight: '1.68', letterSpacing: '-0.006em' }],
        'small': ['0.8125rem', { lineHeight: '1.6' }],
        'micro': ['0.6875rem', { lineHeight: '1.45', letterSpacing: '0.14em' }],
      },

      maxWidth: {
        shell: '1240px',
        prose: '64ch',
        measure: '52ch',
      },

      borderRadius: {
        card: '14px',
        panel: '18px',
      },

      boxShadow: {
        // Dimensionality on the primary action: a coloured cast beneath plus a
        // 1px inner highlight along the top edge, which is what separates a
        // "surface" from a "coloured rectangle".
        action: '0 1px 0 0 rgba(255,255,255,0.16) inset, 0 8px 24px -8px rgba(36,84,235,0.62), 0 2px 6px -2px rgba(0,0,0,0.6)',
        'action-hover': '0 1px 0 0 rgba(255,255,255,0.22) inset, 0 12px 32px -8px rgba(36,84,235,0.75), 0 2px 8px -2px rgba(0,0,0,0.6)',
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 64px -32px rgba(0,0,0,0.9)',
        lift: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 32px 72px -36px rgba(0,0,0,0.95)',
      },

      backgroundImage: {
        // Hairline rules that fade at both ends — a detail that reads as
        // craft and costs nothing.
        'rule-fade': 'linear-gradient(90deg, transparent, rgba(40,50,74,0.9) 18%, rgba(40,50,74,0.9) 82%, transparent)',
        'rule-cobalt': 'linear-gradient(90deg, transparent, rgba(36,84,235,0.55) 50%, transparent)',
      },

      transitionTimingFunction: {
        // One easing curve across the whole site. Consistency here is most of
        // what makes motion feel designed rather than assembled.
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
      },

      keyframes: {
        reveal: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // A node "processing" — used on the hero visualization to show system
        // activity, not for spectacle.
        'pulse-node': {
          '0%, 100%': { opacity: '0.42', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.12)' },
        },
        // A packet travelling one connector in the pipeline.
        flow: {
          '0%': { offsetDistance: '0%', opacity: '0' },
          '12%': { opacity: '1' },
          '88%': { opacity: '1' },
          '100%': { offsetDistance: '100%', opacity: '0' },
        },
        'trace-in': {
          from: { strokeDashoffset: 'var(--dash)' },
          to: { strokeDashoffset: '0' },
        },
        'sweep': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'count-bar': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },

      animation: {
        reveal: 'reveal 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-node': 'pulse-node 2.6s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'trace-in': 'trace-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        sweep: 'sweep 3.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
        'count-bar': 'count-bar 1.1s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;

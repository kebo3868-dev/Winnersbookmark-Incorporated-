import type { Config } from "tailwindcss";

/**
 * Winnersbookmark Daily Blogs — luxury masculine design system.
 *
 * Palette: black, deep charcoal, espresso brown, warm brown, cream, white,
 * antique gold, bronze, rich earth tones — with subtle green (health),
 * ember orange/red (energy), and steel blue (focus/intelligence) accents.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070707",
          900: "#0C0C0D",
          800: "#131315",
          700: "#1A1A1D",
          600: "#232327",
          500: "#2E2E33",
        },
        espresso: {
          900: "#1A120C",
          800: "#241A11",
          700: "#332417",
          600: "#45301E",
          500: "#5A3F28",
        },
        cream: {
          50: "#FAF6EE",
          100: "#F3EDDF",
          200: "#E8DEC8",
          300: "#D8C9AA",
          400: "#C2AE87",
        },
        gold: {
          300: "#E3C98A",
          400: "#D4B26A",
          500: "#C6A15B",
          600: "#A98544",
          700: "#8A6A33",
        },
        bronze: {
          400: "#B08D57",
          500: "#96703F",
          600: "#7C5A31",
        },
        health: {
          400: "#7BA05B",
          500: "#5C8044",
        },
        ember: {
          400: "#E07A3F",
          500: "#C05A2E",
        },
        focus: {
          400: "#6E8FAF",
          500: "#4E6E8E",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        luxe: "0.22em",
      },
      boxShadow: {
        luxe: "0 24px 60px -24px rgba(0,0,0,0.7)",
        "gold-glow": "0 0 40px -12px rgba(198,161,91,0.35)",
      },
      backgroundImage: {
        "gold-radial":
          "radial-gradient(ellipse at top, rgba(198,161,91,0.14), transparent 60%)",
        "hero-vignette":
          "radial-gradient(ellipse at center, rgba(198,161,91,0.10), rgba(7,7,7,0.0) 55%)",
      },
    },
  },
  plugins: [],
};

export default config;

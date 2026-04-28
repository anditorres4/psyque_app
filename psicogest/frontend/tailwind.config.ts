import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * psyque app — Tailwind config
 * Sistema cálido-tech: off-white + azul profundo + verde salvia.
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },

        // Paleta psyque (uso directo en clases Tailwind)
        psy: {
          bg: "#F4F1EC",
          "bg-soft": "#EFEBE3",
          surface: "#FBF9F4",
          line: "#E5DFD3",
          "line-strong": "#D6CFBF",
          ink: { 1: "#1B2A2E", 2: "#3A4A50", 3: "#6B7A7E", 4: "#9AA5A8" },
          primary: "#0F2A4A",
          "primary-soft": "#1E4070",
          sage: "#7C9885",
          "sage-soft": "#A8BDA9",
          "sage-bg": "#E4ECDF",
          terracotta: "#C25C4F",
          amber: "#D4A574",
          gold: "#E0B96B",
          ok: "#4F7F5A",
          warn: "#B8843A",
          danger: "#B0463A",
          info: "#2E5E8A",
        },
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      fontSize: { base: ["14px", { lineHeight: "1.5" }] },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
};

export default config;

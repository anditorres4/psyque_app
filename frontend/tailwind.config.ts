import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta psyque app — PRD Sección 8.3
        primary: "#1E3A5F",
        accent: "#2E86AB",
        success: "#27AE60",
        warning: "#E67E22",
        danger: "#E74C3C",
        bg: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Mínimo 14px por accesibilidad — PRD Sección 8.1
        base: ["14px", { lineHeight: "1.5" }],
      },
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

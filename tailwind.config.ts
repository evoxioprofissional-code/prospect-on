import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens que trocam por tema (definidos em globals.css)
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        soft: "rgb(var(--soft) / <alpha-value>)",
        // Superfície sempre escura (sidebar, avatares) — não inverte no dark
        panel: "#141416",
        // Marca (vermelho) — igual nos dois temas
        brand: {
          DEFAULT: "#E11D2A",
          600: "#C7141F",
          700: "#A50F18",
          50: "#FDECEC",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.05)",
        pop: "0 8px 30px rgba(0,0,0,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;

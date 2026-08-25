import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        ink: "#141416",
        muted: "#6B6B72",
        line: "#E6E6E9",
        soft: "#F5F5F4",
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
        card: "0 1px 2px rgba(20,20,22,0.04)",
        pop: "0 8px 30px rgba(20,20,22,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;

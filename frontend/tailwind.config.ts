import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0c0f14",
          raised: "#141a24",
          border: "#1e2836",
        },
        accent: {
          DEFAULT: "#34d399",
          muted: "#10b981",
        },
        warn: "#fbbf24",
        // New institutional palette
        navy: {
          deep: "#0a1628",
          light: "#0f172a",
        },
        charcoal: "#1e293b",
        gold: "#d4af37",
        "warm-white": "#fafaf9",
        // Keep existing landing colors for backward compatibility
        landing: {
          grid: "#e8eaed",
          green: "#3dcc4e",
          "green-dark": "#2eb840",
          blue: "#5eb3f6",
          "blue-light": "#e8f4fd",
          muted: "#6b7280",
          body: "#4b5563",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        landing: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 8px 32px rgba(0, 0, 0, 0.08)",
        widget: "0 12px 40px rgba(94, 179, 246, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;

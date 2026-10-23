/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--surface-2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        // Ethiopian green — the primary voice of the product.
        brand: {
          50: "#eefbf2",
          100: "#d5f5df",
          200: "#ade9c2",
          300: "#78d79c",
          400: "#41bd74",
          500: "#1fa357",
          600: "#128546",
          700: "#0f6b3a",
          800: "#0d5530",
          900: "#0b4429",
          950: "#042417",
        },
        // Highland gold — used for accents, ceremony and highlights.
        accent: {
          50: "#fdf9e7",
          100: "#fbf1c4",
          200: "#f7e48c",
          300: "#f2d24f",
          400: "#ebbe22",
          500: "#d9a30f",
          600: "#b57c09",
          700: "#92590c",
          800: "#7a4811",
          900: "#683c15",
        },
        coffee: {
          50: "#fbf6ef",
          100: "#f3e8d8",
          200: "#e6d0b1",
          300: "#d5b184",
          400: "#c18d5b",
          500: "#a9703e",
          600: "#8d5632",
          700: "#73432b",
          800: "#5e3827",
          900: "#4e3023",
        },
        eth: {
          red: "#c8102e",
          gold: "#e9b949",
          green: "#0f6b3a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans Ethiopic",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        display: ["Fraunces", "Noto Serif Ethiopic", "Georgia", "Times New Roman", "serif"],
        ethiopic: ["Noto Serif Ethiopic", "Noto Sans Ethiopic", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(60 40 20 / 0.05), 0 16px 36px -24px rgb(60 40 20 / 0.25)",
        lift: "0 22px 55px -26px rgb(45 30 15 / 0.38)",
        glow: "0 0 0 1px rgb(15 107 58 / 0.18), 0 14px 32px -16px rgb(15 107 58 / 0.45)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backgroundImage: {
        "eth-band": "linear-gradient(90deg, #0f6b3a 0 33.3%, #e9b949 33.3% 66.6%, #c8102e 66.6% 100%)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.25)", opacity: "0" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "slide-up": "slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring": "pulse-ring 1.5s ease-out infinite",
      },
    },
  },
  plugins: [],
};

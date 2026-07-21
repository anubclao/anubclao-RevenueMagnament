import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9f8",
          100: "#d3f0ed",
          200: "#a7e1dc",
          300: "#75cdc4",
          400: "#4cb3a8",
          500: "#2d988d",
          600: "#1f7a72",
          700: "#1b615c",
          800: "#194d49",
          900: "#173f3c",
        },
        sea: {
          400: "#3ec5d9",
          500: "#1aa6bd",
          600: "#0c8395",
        },
        sand: {
          50: "#fdf9f3",
          100: "#fbf1e1",
          200: "#f5d9b3",
        },
        coral: {
          500: "#ff6f61",
          600: "#e95a4d",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f5f1",
          100: "#ebe7dd",
          200: "#cfc7b3",
          400: "#8b806a",
          600: "#564c3a",
          800: "#2a261d",
          900: "#161410",
        },
        cinnabar: {
          400: "#d77a5b",
          500: "#c45a3b",
          600: "#a3432a",
        },
        jade: {
          400: "#7aa896",
          500: "#5a8a76",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;

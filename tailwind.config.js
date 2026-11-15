/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: "#FFB800",
          goldDark: "#E5A400",
          goldLight: "#FFF4D1",
          white: "#FFFFFF",
          cream: "#FFFBEF",
          ink: "#17140D",
          muted: "#7A7466",
          line: "#F0E9D6",
        },
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "sans-serif"],
        serif: ["var(--font-playfair)", "serif"],
      },
      borderRadius: {
        luxury: "24px",
      },
      boxShadow: {
        luxury: "0 20px 50px -24px rgba(23, 20, 13, 0.25)",
        goldGlow: "0 12px 26px -10px rgba(255, 184, 0, 0.8)",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fbf8ee',
          100: '#f5efd5',
          200: '#ebdcab',
          300: '#dfc37a',
          400: '#d4af37', // Brand Signature Gold
          500: '#b89228',
          600: '#94701d',
          700: '#75541a',
          800: '#61441c',
          900: '#533a1c',
        },
        luxury: {
          bg: '#0c0e12',
          surface: '#141820',
          card: '#1a1f2c',
          border: '#2a3142',
          muted: '#8e9aa8',
          accent: '#d4af37',
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

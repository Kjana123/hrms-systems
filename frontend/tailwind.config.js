/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}', // Scans all JS/JSX/TS/TSX files in src/
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        indigo: {
          600: '#4F46E5',
          700: '#4338CA',
        },
        teal: {
          600: '#2DD4BF',
          700: '#14B8A6',
        },
        emerald: {
          600: '#10B981',
          700: '#059669',
        },
        amber: {
          600: '#F59E0B',
          700: '#D97706',
        },
        red: {
          600: '#EF4444',
          700: '#DC2626',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
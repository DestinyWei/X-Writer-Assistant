/** @type {import('tailwindcss').Config} */
export default {
  content: [
    '/Users/howe/Documents/X-Writer-Assistant/frontend/index.html',
    '/Users/howe/Documents/X-Writer-Assistant/frontend/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3b55e6',
          700: '#2d44d4',
        },
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark': {
          900: '#0f0f0f',
          800: '#1a1a1a',
          700: '#2d2d2d',
          600: '#3a3a3a',
          500: '#4a4a4a',
        },
        'orange': {
          400: '#ff9c41',
          500: '#ff8c00',
          600: '#e67e00',
        },
      },
    },
  },
  plugins: [],
};

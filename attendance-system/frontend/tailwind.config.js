/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#101319',
        paper: '#f6f7f9',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,19,25,.05), 0 10px 30px -12px rgba(16,19,25,.12)',
        lift: '0 2px 4px rgba(16,19,25,.06), 0 18px 44px -16px rgba(16,19,25,.18)',
      },
    },
  },
  plugins: [],
}

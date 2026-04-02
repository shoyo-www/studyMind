/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans',  'system-ui', 'sans-serif'],
        display: ['Syne',     'system-ui', 'sans-serif'],
        hindi:   ['Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: '#FAFAFA',
        ink:     '#111111',
      },
    },
  },
  plugins: [],
}

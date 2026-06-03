/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    // Inclui componentes do design system
    '../../packages/ui/src/**/*.{js,jsx}',
  ],
  darkMode: 'class',  // Controlado pela classe .dark no <html>
  theme: {
    extend: {},
  },
  plugins: [],
}

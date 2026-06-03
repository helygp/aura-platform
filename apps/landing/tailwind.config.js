/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'aura-bg':        'var(--color-bg)',
        'aura-subtle':    'var(--color-bg-subtle)',
        'aura-surface':   'var(--color-surface)',
        'aura-border':    'var(--color-border)',
        'aura-border-s':  'var(--color-border-strong)',
        'aura-text':      'var(--color-text)',
        'aura-muted':     'var(--color-text-muted)',
        'aura-primary':   'var(--color-primary)',
        'aura-primary-h': 'var(--color-primary-hover)',
        'aura-primary-f': 'var(--color-primary-fg)',
      },
      fontFamily: {
        heading: ['Inter', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
    },
  },
  plugins: [],
}

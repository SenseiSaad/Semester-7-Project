/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Marcellus', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* theme-aware (flip with .dark on <html>) */
        page: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        ink: 'var(--text)',
        stone: 'var(--muted)',
        line: 'var(--line)',
        strong: 'var(--line-strong)',
        primary: 'var(--btn-bg)',
        onprimary: 'var(--btn-text)',
        accent: 'var(--accent)',
        bronze: 'var(--accent)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        /* fixed tokens for the dark cover sections (same in both themes) */
        coal: '#16120D',
        panel: '#211C15',
        paper: '#F2EBDB',
        taupe: '#A79C86',
        lineDark: '#3A332A',
      },
      boxShadow: {
        soft: '0 1px 2px var(--shadow), 0 10px 28px -14px var(--shadow)',
      },
      letterSpacing: {
        widest2: '0.28em',
      },
    },
  },
  plugins: [],
}

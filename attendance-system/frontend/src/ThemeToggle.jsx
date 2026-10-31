import { useState } from 'react'
import { getTheme, toggleTheme } from './theme.js'

/* Sun/moon switch used in the landing nav, the app topbar and the login card. */
export default function ThemeToggle({ dark = false }) {
  const [theme, setTheme] = useState(getTheme())
  return (
    <button
      type="button"
      aria-label="Toggle light / dark theme"
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className={dark ? 'theme-btn-dark' : 'theme-btn'}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  )
}

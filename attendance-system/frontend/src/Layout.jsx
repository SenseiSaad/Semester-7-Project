import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth, homeFor } from './auth'
import ThemeToggle from './ThemeToggle'

const WORDMARK = (
  <span className="font-display text-lg tracking-wide">
    attend<span className="text-bronze">wise</span>
  </span>
)

export function Logo({ to = '/', dark = false }) {
  return (
    <a href={to} className="flex items-center gap-2.5 no-underline">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${dark ? 'bg-primary text-onprimary' : 'bg-primary text-paper'}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </span>
      <span className={dark ? 'text-paper' : 'text-ink'}>{WORDMARK}</span>
    </a>
  )
}

const TEACHER_LINKS = [
  { to: '/t', label: 'Dashboard', end: true },
  { to: '/t/courses', label: 'Courses' },
  { to: '/t/manual', label: 'Manual editor' },
  { to: '/t/violations', label: 'Violations' },
  { to: '/t/eligibility', label: 'Eligibility' },
]
const STUDENT_LINKS = [
  { to: '/s', label: 'Dashboard', end: true },
  { to: '/s/history', label: 'History' },
  { to: '/s/alerts', label: 'Alerts' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const links = user.role === 'teacher' ? TEACHER_LINKS : STUDENT_LINKS

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line topbar backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Logo to={homeFor(user)} />
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden text-[13px] font-semibold text-stone sm:block">{user.name}</span>
            <ThemeToggle />
            <button className="btn btn-ghost btn-sm" onClick={() => { logout(); nav('/') }}>Log out</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `nav-link whitespace-nowrap ${isActive ? 'active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}

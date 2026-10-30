import { Link } from 'react-router-dom'
import { useAuth, homeFor } from '../auth'
import { Logo } from '../Layout'

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm rotate-1">
      <div className="card p-6 shadow-lift">
        <div className="flex items-center justify-between">
          <div>
            <b className="font-display">CS-301 · Discrete Maths</b>
            <div className="text-xs text-slate-400">Session #33 · live</div>
          </div>
          <span className="badge b-open">Open</span>
        </div>
        <div className="mt-4 grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <svg viewBox="0 0 100 100" className="h-36 w-36">
            {Array.from({ length: 100 }).map((_, i) => {
              const x = i % 10, y = Math.floor(i / 10)
              const on = (x * 7 + y * 13 + ((x * y) % 5)) % 3 !== 0
              return on ? <rect key={i} x={x * 10} y={y * 10} width="9" height="9" rx="2" fill="#101319" /> : null
            })}
          </svg>
          <span className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            rotates every 20s
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="font-semibold">Present</span>
          <span className="font-display text-lg font-bold">24 / 30</span>
        </div>
        <div className="progress mt-1"><i style={{ width: '80%' }} /></div>
      </div>
      <span className="absolute -left-3 -top-3 grid h-8 w-8 rotate-[-8deg] place-items-center rounded-full bg-white shadow-soft">
        <span className="h-3 w-3 rounded-full bg-ink" />
      </span>
    </div>
  )
}

const Chip = ({ children }) => <span className="chip"><span className="dot" />{children}</span>

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-white">
      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Logo />
          <nav className="ml-4 hidden items-center gap-6 text-sm font-semibold text-slate-500 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#roles" className="hover:text-ink">Roles</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            {user ? (
              <Link className="btn-dark btn-sm" to={homeFor(user)}>Go to dashboard</Link>
            ) : (
              <>
                <Link className="btn-ghost btn-sm" to="/login">Log in</Link>
                <Link className="btn-dark btn-sm" to="/signup">Student sign up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="dotgrid">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 md:grid-cols-2 md:py-24">
          <div>
            <Chip>Student Attendance &amp; Exam Eligibility System</Chip>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight md:text-6xl">
              ATTENDANCE<br />YOU CAN&apos;T <span className="underline decoration-4 underline-offset-8">FAKE.</span>
              <span className="ml-2 inline-block">✳</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-500">
              Teachers open a session, a rotating signed QR appears, students scan from
              their registered phone. Eligibility for the exam computes itself.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/login" className="btn-dark">Teacher login →</Link>
              <Link to="/signup" className="btn-ghost">Sign up with claim code</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <Chip>HMAC-signed QR</Chip>
              <Chip>One device per student</Chip>
              <Chip>Audited manual edits</Chip>
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Chip>How it works</Chip>
          <h2 className="mt-4 max-w-xl font-display text-4xl font-bold tracking-tight">
            Three steps. Zero paperwork.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ['01', 'Teacher starts a session', 'A QR code appears and re-signs itself every 20 seconds. Screenshotting it is useless.'],
              ['02', 'Students scan from their phone', 'Their one registered device, on campus network if the teacher enables the IP check.'],
              ['03', 'Eligibility updates instantly', '75% rule with a 5-point at-risk band. Reports export to CSV for the exam cell.'],
            ].map(([n, t, d]) => (
              <div key={n} className="card p-6">
                <span className="font-display text-sm font-bold text-slate-300">{n}</span>
                <h3 className="mt-2 font-display text-lg font-bold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* roles */}
      <section id="roles" className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Chip>Two roles. Nothing else.</Chip>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="card p-7">
              <h3 className="font-display text-2xl font-bold">Teacher</h3>
              <p className="mt-1 text-sm text-slate-500">Runs the class and owns the data.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>▸ Import roster CSV → claim codes generated per student</li>
                <li>▸ Live session screen with rotating QR + present count</li>
                <li>▸ Manual attendance editor — every edit needs a reason</li>
                <li>▸ Violations log + eligibility report with CSV export</li>
              </ul>
              <Link to="/login" className="btn-dark btn-sm mt-6">Teacher login</Link>
            </div>
            <div className="card p-7">
              <h3 className="font-display text-2xl font-bold">Student</h3>
              <p className="mt-1 text-sm text-slate-500">Registers once with a claim code.</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>▸ Sign up with email + student ID + claim code from the roster</li>
                <li>▸ First login locks the app to your one device</li>
                <li>▸ Scan the class QR — in seconds, before it rotates</li>
                <li>▸ Track % per course, status badge, classes needed</li>
              </ul>
              <Link to="/signup" className="btn-ghost btn-sm mt-6">Sign up</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-6xl rounded-[2rem] bg-ink px-8 py-14 text-center text-white">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Ready to run your first session?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
            Demo teacher: teacher@uni.edu / teach1234
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/login" className="btn-dark !bg-white !text-ink">Log in</Link>
            <Link to="/signup" className="btn-ghost !border-white/25 !bg-transparent !text-white">Student sign up</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-[13px] text-slate-400">
          <span>© 2026 attendwise · course project, demo data</span>
          <span>Django REST + React</span>
        </div>
      </footer>
    </div>
  )
}

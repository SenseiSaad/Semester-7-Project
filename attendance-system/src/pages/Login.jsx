import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, homeFor } from '../auth'
import { Logo } from '../Layout'
import ThemeToggle from '../ThemeToggle'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') === 'student' ? 'student' : 'teacher')
  const DEMO = {
    teacher: { email: 'teacher@uni.edu', password: 'teach1234' },
    student: { email: '2022-cs-001@uni.edu', password: 'study1234' },
  }
  const [email, setEmail] = useState(DEMO[params.get('role') === 'student' ? 'student' : 'teacher'].email)
  const [password, setPassword] = useState(DEMO[params.get('role') === 'student' ? 'student' : 'teacher'].password)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = login(email.trim(), password, role)
      const next = params.get('next')
      nav(next ? decodeURIComponent(next) : homeFor(u), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dark-section grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Logo dark />
          <ThemeToggle dark />
        </div>
        <div className="rounded-3xl border border-lineDark bg-panel p-8">
          <h1 className="text-center font-display text-2xl tracking-wide text-paper">Sign in</h1>
          <p className="mt-1 text-center text-[13px] text-taupe">Pick your role, then sign in.</p>

          {/* role toggle */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-lineDark bg-coal p-1">
            {['teacher', 'student'].map((r) => (
              <button key={r} type="button" onClick={() => { setRole(r); setEmail(DEMO[r].email); setPassword(DEMO[r].password); setError('') }}
                className={`rounded-full py-2 text-[13px] font-semibold capitalize transition ${
                  role === r ? 'bg-primary text-onprimary' : 'text-taupe hover:text-paper'}`}>
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <input className="dark-input" type="email" required placeholder="Email"
              autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="dark-input" type="password" required placeholder="Password"
              autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <div className="rounded-xl border border-[var(--bad)] bg-[#2A1B16] px-4 py-3 text-sm text-[#E0A192]">{error}</div>}
            <button className="btn btn-paper w-full" disabled={busy}>
              {busy ? 'Signing in…' : `Log in as ${role}`}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-lineDark bg-coal px-4 py-3 text-center text-[12px] text-taupe">
            {role === 'teacher'
              ? <>Demo teacher — <span className="text-paper">teacher@uni.edu / teach1234</span></>
              : <>Demo student — <span className="text-paper">2022-cs-001@uni.edu / study1234</span><br />Accounts are created by the teacher, there is no self-signup.</>}
          </div>
        </div>
        <p className="mt-6 text-center text-[13px] text-taupe">
          <Link to="/" className="hover:text-paper">← Back to the overview</Link>
        </p>
      </div>
    </div>
  )
}

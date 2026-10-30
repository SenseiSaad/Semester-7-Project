import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, homeFor } from '../auth'
import { Logo } from '../Layout'
import { errMsg } from '../api'

export default function Login() {
  const { login, user } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) { nav(homeFor(user)); }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(email.trim(), password)
      const next = params.get('next')
      nav(next ? decodeURIComponent(next) : homeFor(u), { replace: true })
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="neo-bg grid min-h-screen place-items-center px-4 py-10">
      <div className="neo-card w-full max-w-sm p-9">
        <div className="mb-7 flex justify-center"><Logo /></div>
        <h1 className="text-center font-display text-xl font-bold">Welcome back</h1>
        <p className="mt-1 text-center text-[13px] text-slate-400">
          Teachers and students sign in here.
        </p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <input className="neo-input" type="email" required placeholder="Email"
            autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="neo-input" type="password" required placeholder="Password"
            autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="alert alert-error !mb-0">{error}</div>}
          <button className="neo-btn-dark" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-400">
          <span className="h-px flex-1 bg-slate-300/70" />or<span className="h-px flex-1 bg-slate-300/70" />
        </div>
        <Link to="/signup" className="neo-btn block text-center no-underline">
          Sign up with claim code
        </Link>
        <p className="mt-6 text-center text-[12px] text-slate-400">
          Demo — teacher: <code className="font-semibold text-ink">teacher@uni.edu / teach1234</code><br />
          student: <code className="font-semibold text-ink">2022-cs-001@uni.edu / study1234</code>
        </p>
      </div>
    </div>
  )
}

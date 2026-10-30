import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errMsg } from '../api'
import { Logo } from '../Layout'

export default function Signup() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', student_id: '', claim_code: '', password: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/auth/register/', {
        ...form,
        email: form.email.trim(),
        student_id: form.student_id.trim().toUpperCase(),
        claim_code: form.claim_code.trim().toUpperCase(),
      })
      setOk(true)
      setTimeout(() => nav('/login'), 1200)
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
        <h1 className="text-center font-display text-xl font-bold">Student sign up</h1>
        <p className="mt-1 text-center text-[13px] text-slate-400">
          Use the claim code your teacher gave you.
        </p>
        {ok ? (
          <div className="alert alert-ok mt-6 text-center">
            Account created — redirecting to login…
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <input className="neo-input" required placeholder="Full name" value={form.name} onChange={set('name')} />
            <input className="neo-input" type="email" required placeholder="Email" value={form.email} onChange={set('email')} />
            <input className="neo-input" required placeholder="Student ID (e.g. 2022-CS-009)"
              value={form.student_id} onChange={set('student_id')} />
            <input className="neo-input" required placeholder="Claim code (e.g. 587D1B8A)"
              value={form.claim_code} onChange={set('claim_code')} />
            <input className="neo-input" type="password" required minLength={6} placeholder="Password (min 6)"
              value={form.password} onChange={set('password')} />
            {error && <div className="alert alert-error !mb-0">{error}</div>}
            <button className="neo-btn-dark" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-[13px] text-slate-400">
          Already registered? <Link to="/login" className="font-bold text-ink">Log in</Link>
        </p>
      </div>
    </div>
  )
}

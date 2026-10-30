import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errMsg, getDeviceToken } from '../api'
import { useAuth, homeFor } from '../auth'
import { Logo } from '../Layout'

/* Scan page — used both at /attend (QR link target) and /s/scan.
   The QR encodes /attend?c=CODE; a logged-out phone lands here, logs in,
   and comes straight back to submit the code. */
export default function Attend() {
  const { user, loading, setUser } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const code = params.get('c') || ''

  const [input, setInput] = useState('')
  const [state, setState] = useState(null) // {kind, text}
  const [busy, setBusy] = useState(false)
  const doneCode = useRef('') // don't auto-submit the same QR twice (user refresh re-fires the effect)

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(loc.pathname + loc.search)
      nav(`/login?next=${next}`, { replace: true })
    }
  }, [loading, user]) // eslint-disable-line

  async function submit(codeValue) {
    if (!codeValue) return
    setBusy(true)
    setState(null)
    try {
      const { data } = await api.post('/attendance/scan/', {
        code: codeValue.trim(),
        device_token: getDeviceToken(),
      })
      if (data.status === 'already_marked') {
        setState({ kind: 'warn', text: data.detail })
      } else {
        setState({ kind: 'ok', text: data.detail })
        const me = await api.get('/auth/me/')
        setUser(me.data)
      }
    } catch (err) {
      const d = err?.response?.data || {}
      const kind = d.violation ? 'bad' : 'warn'
      setState({ kind, text: errMsg(err) })
      if (d.reason === 'unregistered_device') {
        try {
          await api.post('/devices/register/', { device_token: getDeviceToken() })
          const me = await api.get('/auth/me/')
          setUser(me.data)
          setState({ kind: 'warn', text: 'Device registered. Scan the current QR again.' })
        } catch { /* leave the violation message visible */ }
      }
    } finally {
      setBusy(false)
    }
  }

  // auto-submit when arriving from a QR link
  useEffect(() => {
    if (user && code && !busy && doneCode.current !== code) {
      doneCode.current = code
      submit(code)
    }
  }, [user, code]) // eslint-disable-line

  if (loading || !user) return <div className="neo-bg grid min-h-screen place-items-center text-sm font-semibold text-slate-400">Loading…</div>

  const back = homeFor(user)

  return (
    <div className="neo-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-sm">
        <div className="mb-7 flex justify-center"><Logo /></div>

        <div className="neo-card p-7">
          <h1 className="text-center font-display text-xl font-bold">Scan attendance</h1>
          <p className="mt-1 text-center text-[13px] text-slate-400">
            {user.role === 'student'
              ? 'Point your camera at the teacher screen QR.'
              : 'Teachers do not scan — this page is for students.'}
          </p>

          {!state && !code && (
            <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); submit(input) }}>
              <input className="neo-input font-mono text-sm" placeholder="…or paste the code here"
                value={input} onChange={(e) => setInput(e.target.value)} />
              <button className="neo-btn-dark" disabled={busy || !input.trim()}>
                {busy ? 'Submitting…' : 'Submit code'}
              </button>
            </form>
          )}

          {state && (
            <div className={`alert alert-${state.kind} mt-6 !mb-0 text-center`}>
              {state.kind === 'ok' && '✓ '}
              {state.kind === 'bad' && '🚨 '}
              {state.text}
            </div>
          )}
          {busy && !state && <div className="mt-6 text-center text-sm font-semibold text-slate-400">Submitting…</div>}

          {!state && code && !busy && <div className="mt-6 text-center text-sm text-slate-400">Submitting code…</div>}

          {user.role === 'student' && !user.device_registered && (
            <div className="alert alert-warn mt-4 !mb-0 text-[13px]">
              This browser is not registered as your device yet. Submitting a scan
              registers it automatically.
            </div>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <Link to={back} className="btn-ghost btn-sm">Dashboard</Link>
            {user.role === 'student' && <Link to="/s/history" className="btn-ghost btn-sm">History</Link>}
            {user.role === 'student' && (
              <button className="btn-ghost btn-sm" onClick={() => { setState(null); setInput('') }}>
                Scan again
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] text-slate-400">
          One device per student · codes expire after 20s · violations are logged
        </p>
      </div>
    </div>
  )
}

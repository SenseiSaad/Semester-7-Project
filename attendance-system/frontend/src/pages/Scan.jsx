import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth, useDB, update } from '../auth'
import { Logo } from '../Layout'
import { ensureTokens, redeemToken, getTokenForStudent } from '../logic/qr.js'
import { getStudentCourseSummary } from '../logic/eligibility.js'
import { courseOf } from '../logic/eligibility.js'
import { Badge } from '../ui'

/* Student scan page — the target of the session join QR (/scan?s=…).
   The student's own one-time token is validated and spent here. */
export default function Scan() {
  const { user, loading } = useAuth()
  const db = useDB()
  const [params] = useSearchParams()
  const [result, setResult] = useState(null) // {kind, text}
  const [busyId, setBusyId] = useState(null)

  if (loading || !user) {
    return (
      <div className="dark-section grid min-h-screen place-items-center text-sm font-semibold text-taupe">
        Loading…
      </div>
    )
  }
  if (user.role !== 'student') {
    return (
      <div className="dark-section grid min-h-screen place-items-center px-4">
        <div className="rounded-3xl border border-lineDark bg-panel p-10 text-center">
          <h1 className="font-display text-2xl text-paper">Teachers do not scan</h1>
          <p className="mt-2 text-sm text-taupe">This page spends a student's one-time QR token.</p>
          <Link to="/t" className="btn btn-ghost-dark btn-sm mt-6">Go to the teacher dashboard</Link>
        </div>
      </div>
    )
  }

  const openSessions = db.sessions
    .filter((s) => s.status === 'open')
    .filter((s) => db.enrollments.some((e) => e.studentId === user.id && e.courseId === s.courseId))
    .sort((a, b) => b.date.localeCompare(a.date))

  const focusId = params.get('s')
  const ordered = focusId
    ? [...openSessions.filter((s) => s.id === focusId), ...openSessions.filter((s) => s.id !== focusId)]
    : openSessions

  function mark(sessionId) {
    setBusyId(sessionId)
    setResult(null)
    try {
      update((d) => {
        const res = redeemToken(d, { sessionId, studentId: user.id })
        setResult(res.ok
          ? { kind: 'ok', text: res.updated ? 'Updated your existing mark to present.' : 'Marked present.' }
          : res.reason === 'duplicate_qr'
            ? { kind: res.warning ? 'warn' : 'bad', text: res.error }
            : { kind: 'warn', text: res.error || 'Could not mark attendance.' })
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="dark-section min-h-screen px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex justify-center"><Logo dark /></div>

        <div className="rounded-3xl border border-lineDark bg-panel p-8">
          <h1 className="text-center font-display text-2xl tracking-wide text-paper">Scan attendance</h1>
          <p className="mt-1 text-center text-[13px] text-taupe">
            One token per session. A second scan logs a violation, it does not double-count.
          </p>

          {result && (
            <div className={`mt-6 rounded-xl border px-4 py-3 text-center text-sm font-medium ${
              result.kind === 'ok' ? 'border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok-text)]'
              : result.kind === 'bad' ? 'border-[var(--bad)] bg-[var(--bad-bg)] text-[var(--bad-text)]'
              : 'border-[var(--warn)] bg-[var(--warn-bg)] text-[var(--warn-text)]'}`}>
              {result.text}
            </div>
          )}

          <div className="mt-7 space-y-4">
            {ordered.map((s) => {
              const course = courseOf(db, s.courseId)
              const token = getTokenForStudent(db, s.id, user.id)
              const already = token?.used
              const summary = getStudentCourseSummary(db, user.id, s.courseId)
              return (
                <div key={s.id} className="rounded-2xl border border-lineDark bg-coal p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10.5px] font-bold uppercase tracking-widest text-bronze">{course?.code}</span>
                      <h3 className="font-display text-lg tracking-wide text-paper">{course?.name}</h3>
                      <span className="text-xs text-taupe">{s.date} · {summary.present}/{summary.held} classes attended</span>
                    </div>
                    {already && <Badge v="present">Marked</Badge>}
                  </div>
                  {already ? (
                    <p className="mt-3 rounded-xl border border-lineDark bg-panel px-4 py-2.5 text-[13px] text-taupe">
                      Your token for this session is spent. Scanning again would only log a violation.
                    </p>
                  ) : (
                    <button className="btn btn-paper btn-sm mt-4 w-full" disabled={busyId === s.id}
                      onClick={() => mark(s.id)}>
                      {busyId === s.id ? 'Spending token…' : 'Mark me present'}
                    </button>
                  )}
                </div>
              )
            })}
            {ordered.length === 0 && (
              <div className="rounded-2xl border border-lineDark bg-coal p-8 text-center text-sm text-taupe">
                No open sessions right now. Attendance can only be marked while the teacher's session is open.
              </div>
            )}
          </div>

          <div className="mt-7 flex justify-center gap-2">
            <Link to="/s" className="btn btn-ghost-dark btn-sm">Dashboard</Link>
            <Link to="/s/history" className="btn btn-ghost-dark btn-sm">History</Link>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px] text-taupe">
          Signed in as {user.name} ({user.rollNo}) · tokens are one-time per session
        </p>
      </div>
    </div>
  )
}

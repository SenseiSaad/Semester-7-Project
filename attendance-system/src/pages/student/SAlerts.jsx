import { useAuth, useDB } from '../../auth'
import { PageHead, Empty } from '../../ui'
import { getViolations } from '../../logic/attendance.js'

export default function SAlerts() {
  const { user } = useAuth()
  const db = useDB()
  const violations = getViolations(db, { studentId: user.id })

  return (
    <div>
      <PageHead title="Alerts" sub={violations.length ? `${violations.length} logged event${violations.length === 1 ? '' : 's'}` : 'All clear'} />
      {violations.length === 0 ? (
        <div className="card"><Empty title="No violations on record" sub="If a scan is ever rejected, the reason shows up here." /></div>
      ) : (
        <div className="space-y-2">
          {violations.map((v) => v.warning && !v.escalated ? (
            <div key={v.id} className="card border-[var(--warn)] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-ink">
                  You tried to reuse a session QR token. Under the good-standing policy this
                  first offense was recorded as a <b>private warning</b> — it was not shared
                  with your instructor.
                </span>
                <span className="badge b-at_risk shrink-0">Warning</span>
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-stone">
                {v.courseCode} · {new Date(v.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <div key={v.id} className="card border-[var(--bad)] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-ink">
                  Duplicate QR attempt — the scan was ignored and the violation was escalated
                  to your instructor.
                </span>
                <span className="badge b-not-eligible shrink-0">Escalated</span>
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-stone">
                {v.courseCode} · {new Date(v.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

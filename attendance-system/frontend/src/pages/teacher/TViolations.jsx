import { useState } from 'react'
import { useDB } from '../../auth'
import { PageHead, Empty } from '../../ui'
import { getViolations } from '../../logic/attendance.js'

const TYPE_TEXT = {
  duplicate_qr: 'Tried to reuse an already-spent QR token',
}

function ViolationsTable({ rows, dateFor }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>When</th><th>Student</th><th>Course</th><th>Session date</th><th>Type</th></tr></thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap text-stone">{new Date(v.timestamp).toLocaleString()}</td>
              <td><b>{v.studentName}</b><div className="text-xs text-stone">{v.studentRollNo}</div></td>
              <td className="font-semibold">{v.courseCode}</td>
              <td className="text-stone">{dateFor(v.sessionId)}</td>
              <td className="text-[13px] font-semibold text-bad">{TYPE_TEXT[v.type] || v.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TViolations() {
  const db = useDB()
  const [courseId, setCourseId] = useState('')
  const [type, setType] = useState('')
  const dateFor = (sessionId) => db.sessions.find((s) => s.id === sessionId)?.date || '—'

  const all = getViolations(db, { courseId: courseId || undefined, type: type || undefined })
  const escalated = all.filter((v) => v.escalated || v.warning === undefined)
  const warnings = all.filter((v) => v.warning === true && !v.escalated)

  return (
    <div>
      <PageHead title="Violations log" sub="Escalated violations appear here; good-standing first offenses stay as warnings below" />

      <div className="mb-5 flex flex-wrap gap-3">
        <select className="input max-w-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">All courses</option>
          {db.courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <select className="input max-w-[220px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="duplicate_qr">duplicate_qr</option>
        </select>
      </div>

      {all.length === 0 ? (
        <div className="card"><Empty title="No violations logged" sub="Duplicate QR attempts will appear here the moment they happen." /></div>
      ) : (
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 font-display text-xl tracking-wide">
              Escalated <span className="ml-1 rounded-full bg-[var(--bad-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--bad-text)]">{escalated.length}</span>
            </h3>
            {escalated.length === 0
              ? <div className="card"><Empty title="Nothing escalated" sub="All logged events stayed at warning level." /></div>
              : <ViolationsTable rows={escalated} dateFor={dateFor} />}
          </div>
          <div>
            <h3 className="mb-3 font-display text-xl tracking-wide">
              Warnings — not escalated <span className="ml-1 rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--warn-text)]">{warnings.length}</span>
            </h3>
            <p className="mb-3 text-[13px] text-stone">First offenses by students who were eligible in the course at the time. Visible here for completeness — never counted against them.</p>
            {warnings.length === 0
              ? <div className="card"><Empty title="No warnings" /></div>
              : <ViolationsTable rows={warnings} dateFor={dateFor} />}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useDB, update } from '../../auth'
import { PageHead, Badge, ArmBtn } from '../../ui'
import { courseOf } from '../../logic/eligibility.js'
import { getRoster, presentCount, unmarkedStudents, getSessions } from '../../logic/courses.js'
import { getViolations } from '../../logic/attendance.js'
import { ensureTokens } from '../../logic/qr.js'
import { parseCSV, validateAttendanceRows } from '../../logic/csv.js'
import { markAttendance } from '../../logic/attendance.js'

export default function TSession() {
  const { id } = useParams()
  const db = useDB()
  const [csvText, setCsvText] = useState('')
  const [csvResult, setCsvResult] = useState(null)

  const session = db.sessions.find((s) => s.id === id)
  if (!session) {
    return (
      <div>
        <PageHead title="Session" />
        <div className="alert alert-error">Session not found. <Link to="/t/courses">Back to courses.</Link></div>
      </div>
    )
  }
  const course = courseOf(db, session.courseId)
  const roster = getRoster(db, session.courseId)
  const present = presentCount(db, id)
  const missing = unmarkedStudents(db, id)
  const violations = getViolations(db, { sessionId: id })

  // tokens exist for every enrolled student (idempotent)
  ensureTokens(db, id)

  const joinUrl = `${window.location.origin}/scan?s=${id}`
  const open = session.status === 'open'

  function importCsv(e) {
    e.preventDefault()
    setCsvResult(null)
    update((d) => {
      const parsed = parseCSV(csvText)
      const { valid, skipped } = validateAttendanceRows(d, id, parsed)
      let created = 0
      valid.forEach((v) => {
        const res = markAttendance(d, { sessionId: id, studentId: v.studentId, status: v.status, method: 'csv' })
        if (res.ok && res.created) created++
      })
      setCsvResult({ created, skipped })
      if (valid.length) setCsvText('')
    })
  }

  return (
    <div>
      <PageHead title={`${course.code} — session ${session.date}`} sub={open ? 'Open — students can scan' : 'Closed — records are frozen for students'}>
        <Badge v={session.status} />
        <Link to={`/t/manual?session=${id}`} className="btn btn-ghost btn-sm">Manual editor</Link>
        {open && <ArmBtn onConfirm={() => update((d) => { const s = d.sessions.find((x) => x.id === id); if (s) s.status = 'closed' })}>Close session</ArmBtn>}
      </PageHead>

      {!open && (
        <div className="alert alert-warn">This session is closed. Students can no longer scan; records stay frozen unless you edit them in the manual editor (admin override).</div>
      )}
      {violations.length > 0 && (
        <div className="alert alert-error">
          🚨 {violations.length} violation{violations.length === 1 ? '' : 's'} in this session — a student tried to reuse an already-spent QR token.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* join QR + CSV import */}
        <div>
          <div className={`card p-6 ${open ? '' : 'opacity-40'}`}>
            <div className="grid place-items-center rounded-2xl border-2 border-strong p-6">
              {open ? (
                <>
                  <QRCodeSVG value={joinUrl} size={220} level="M" />
                  <div className="mt-4 text-center">
                    <div className="font-display text-lg tracking-wide">Join this session</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-stone">
                      students scan → log in → one-time token spent
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-14 text-center text-sm font-semibold text-stone">Session closed — QR disabled</div>
              )}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-stone">
              Each enrolled student holds a unique one-time token for this session. Scanning
              spends it; scanning again logs a violation instead of a second mark.
            </p>
          </div>

          {open && (
            <form onSubmit={importCsv} className="card mt-4 p-5">
              <h3 className="font-display text-lg tracking-wide">Upload attendance CSV</h3>
              <p className="mt-1 text-[13px] text-stone">Columns: <b>rollNo,status</b> — unknown students and duplicates are skipped with a reason.</p>
              <textarea className="input mt-3 font-mono text-[13px]" rows="4"
                placeholder={'2022-CS-007,present\n2022-CS-008,absent'}
                value={csvText} onChange={(e) => setCsvText(e.target.value)} />
              <button className="btn btn-dark btn-sm mt-3" disabled={!csvText.trim()}>Import</button>
              {csvResult && (
                <div className="mt-3 rounded-xl border border-line bg-surface2 p-3 text-[13px]">
                  <b className="text-ok">{csvResult.created} marked</b>
                  {csvResult.skipped.length > 0 && (
                    <div className="mt-1 text-warn">
                      {csvResult.skipped.length} skipped: {csvResult.skipped.map((s) => `row ${s.line} (${s.reason})`).join('; ')}
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>

        {/* live side */}
        <div className="card p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-stone">Present now</div>
              <div className="stat-value">{present} <span className="text-xl text-stone">/ {roster.length}</span></div>
            </div>
            <Link to={`/t/eligibility?course=${course.id}`} className="btn btn-ghost btn-sm">Eligibility</Link>
          </div>
          <div className="progress mt-3"><i style={{ width: `${roster.length ? (present / roster.length) * 100 : 0}%` }} /></div>

          <h3 className="mb-2 mt-6 font-display text-lg tracking-wide">Marks</h3>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {db.attendanceRecords.filter((r) => r.sessionId === id).length === 0 && (
              <p className="py-6 text-center text-sm text-stone">No marks yet — show the join QR or use the manual editor.</p>
            )}
            {db.attendanceRecords.filter((r) => r.sessionId === id).map((r) => {
              const u = db.users.find((x) => x.id === r.studentId)
              return (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-surface2 px-3.5 py-2 text-sm">
                  <span className="font-semibold">{u?.name}</span>
                  <span className="flex items-center gap-2 text-xs text-stone">
                    {r.method === 'qr' ? 'QR token' : r.method === 'csv' ? 'CSV' : 'manual'}
                    <Badge v={r.status} />
                  </span>
                </div>
              )
            })}
          </div>

          {missing.length > 0 && open && (
            <>
              <h3 className="mb-2 mt-5 font-display text-lg tracking-wide">
                Not yet scanned
                <span className="ml-2 rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--warn-text)]">{missing.length}</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((m) => (
                  <span key={m.studentId} className="rounded-full border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-1 text-[12px] font-semibold text-[var(--warn-text)]">
                    {m.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

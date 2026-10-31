import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDB, update } from '../../auth'
import { PageHead, Badge, Empty } from '../../ui'
import { getSessions, sessionRows, presentCount } from '../../logic/courses.js'
import { saveManualAttendance, markAttendance } from '../../logic/attendance.js'
import { parseCSV, validateAttendanceRows } from '../../logic/csv.js'
import { courseOf } from '../../logic/eligibility.js'

/* Manual attendance editor — checklist of enrolled students with P/A toggles.
   Closed sessions are frozen; the admin can override with an explicit unlock. */
export default function TManual() {
  const [params, setParams] = useSearchParams()
  const courseId = params.get('course') || ''
  const sessionId = params.get('session') || ''
  const db = useDB()

  const [marks, setMarks] = useState({})        // studentId → status (draft)
  const [msg, setMsg] = useState(null)          // {kind, text}
  const [override, setOverride] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvResult, setCsvResult] = useState(null)

  const courses = db.courses
  const sessions = courseId ? getSessions(db, courseId) : []
  const session = sessionId ? db.sessions.find((s) => s.id === sessionId) : null
  const rows = sessionId ? sessionRows(db, sessionId) : []
  const editable = session && (session.status === 'open' || override)
  const drafts = { ...Object.fromEntries(rows.map((r) => [r.studentId, r.status])), ...marks }

  function pickCourse(cid) { setMarks({}); setMsg(null); setParams({ course: cid }) }
  function pickSession(sid) { setMarks({}); setMsg(null); setCsvResult(null); setParams({ course: courseId, session: sid }) }

  function toggle(studentId, status) {
    setMarks((m) => ({ ...m, [studentId]: status }))
  }

  function save() {
    if (!sessionId) return
    setMsg(null)
    let res = null
    update((d) => {
      // only save rows the teacher actually toggled
      const pending = Object.fromEntries(Object.entries(marks).filter(([sid, st]) => {
        const row = d.attendanceRecords.find((r) => r.sessionId === sessionId && r.studentId === sid)
        const current = row ? row.status : 'unmarked'
        return current !== st
      }))
      res = saveManualAttendance(d, { sessionId, marks: pending, actorRole: override ? 'teacher' : 'teacher' })
    })
    setMarks({})
    setMsg(res.errors.length
      ? { kind: 'warn', text: `Saved with ${res.errors.length} rejected row(s).` }
      : { kind: 'ok', text: `Saved — ${res.created} created, ${res.updated} updated.` })
  }

  function importCsv(e) {
    e.preventDefault()
    setCsvResult(null)
    update((d) => {
      const parsed = parseCSV(csvText)
      const { valid, skipped } = validateAttendanceRows(d, sessionId, parsed)
      let created = 0
      valid.forEach((v) => {
        const res = markAttendance(d, { sessionId, studentId: v.studentId, status: v.status, method: 'csv' })
        if (res.ok && res.created) created++
      })
      setCsvResult({ created, skipped })
      if (valid.length) setCsvText('')
    })
  }

  return (
    <div>
      <PageHead title="Manual attendance editor" sub="Checklist per session — every change updates the same record store" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select className="input max-w-xs" value={courseId} onChange={(e) => pickCourse(e.target.value)}>
          <option value="">— pick course —</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <select className="input max-w-xs" value={sessionId} disabled={!courseId} onChange={(e) => pickSession(e.target.value)}>
          <option value="">— pick session —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.date} · {s.status} · {presentCount(db, s.id)}/{rows.length || ''}</option>
          ))}
        </select>
        {session && session.status === 'closed' && (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-stone">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="h-4 w-4" />
            Admin override — edit this closed session
          </label>
        )}
      </div>

      {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}
      {session && session.status === 'closed' && !override && (
        <div className="alert alert-warn">This session is closed, so its records are frozen. Tick “Admin override” above to edit them anyway.</div>
      )}

      {session && (
        <div className="card overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
            <div>
              <h3 className="font-display text-lg tracking-wide">{courseOf(db, session.courseId)?.code} · {session.date}</h3>
              <p className="text-[13px] text-stone">{presentCount(db, sessionId)} present / {rows.length} enrolled</p>
            </div>
            {editable && <button className="btn btn-dark btn-sm" onClick={save}>Save checklist</button>}
          </div>
          <div className="mt-2">
            {rows.map((r) => (
              <div key={r.studentId} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <b className="text-sm">{r.name}</b>
                  <div className="text-xs text-stone">{r.rollNo}{r.method ? ` · ${r.method === 'qr' ? 'QR token' : r.method === 'csv' ? 'CSV' : 'manual'}` : ''}</div>
                </div>
                <span className="hidden sm:block"><Badge v={marks[r.studentId] || r.status} /></span>
                <div className="flex gap-1.5">
                  <button
                    className={`btn btn-ghost btn-sm ${drafts[r.studentId] === 'present' ? '!border-ok !bg-[var(--ok-bg)] !text-[var(--ok-text)]' : ''}`}
                    disabled={!editable}
                    onClick={() => toggle(r.studentId, 'present')}>Present</button>
                  <button
                    className={`btn btn-ghost btn-sm ${drafts[r.studentId] === 'absent' ? '!border-bad !bg-[var(--bad-bg)] !text-[var(--bad-text)]' : ''}`}
                    disabled={!editable}
                    onClick={() => toggle(r.studentId, 'absent')}>Absent</button>
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && <Empty title="No students on this roster" />}
        </div>
      )}

      {session && editable && (
        <form onSubmit={importCsv} className="card mt-6 p-5">
          <h3 className="font-display text-lg tracking-wide">…or upload a CSV for this session</h3>
          <p className="mt-1 text-[13px] text-stone">Columns: <b>rollNo,status</b>. Unknown students are skipped; duplicates for this session are blocked and reported.</p>
          <textarea className="input mt-3 font-mono text-[13px]" rows="3"
            placeholder={'2022-CS-007,present\n2022-CS-008,absent'}
            value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          <button className="btn btn-dark btn-sm mt-3" disabled={!csvText.trim()}>Import CSV</button>
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
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errMsg } from '../../api'
import { PageHead, Spinner, Badge, Empty } from '../../ui'

/* Manual attendance editor — every change demands a reason and is audited.
   Works on open sessions only (closed ones are frozen server-side). */
export default function TManual() {
  const [params, setParams] = useSearchParams()
  const courseId = params.get('course') || ''
  const sessionId = params.get('session') || ''

  const [courses, setCourses] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/courses/').then((r) => {
      setCourses(r.data)
      if (!courseId && r.data[0]) {
        setParams({ course: String(r.data[0].id) }, { replace: true })
      }
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!courseId) return
    setData(null)
    api.get('/sessions/', { params: { course: courseId } }).then((r) => {
      setSessions(r.data)
      const want = sessionId && r.data.find((s) => String(s.id) === sessionId)
      const target = want || r.data.find((s) => s.status === 'open')
      if (!sessionId && target) {
        setParams({ course: courseId, session: String(target.id) }, { replace: true })
      }
    })
  }, [courseId]) // eslint-disable-line

  function loadRows() {
    if (!sessionId) return
    api.get(`/sessions/${sessionId}/records/`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)))
  }
  useEffect(() => { loadRows() }, [sessionId]) // eslint-disable-line

  const [editing, setEditing] = useState(null) // {key, status, reason}
  const [rowError, setRowError] = useState('')

  async function save(row) {
    setRowError('')
    if (!editing || editing.reason.trim().length < 4) {
      setRowError('A reason of at least 4 characters is required for every change.')
      return
    }
    try {
      if (row.record_id) {
        await api.patch(`/attendance/records/${row.record_id}/`,
          { status: editing.status, reason: editing.reason.trim() })
      } else {
        await api.post('/attendance/records/',
          { session: Number(sessionId), enrollment_id: row.enrollment_id,
            status: editing.status, reason: editing.reason.trim() })
      }
      setEditing(null)
      loadRows()
    } catch (err) { setRowError(errMsg(err)) }
  }

  if (!courses) return <Spinner />

  const openSessions = (sessions || []).filter((s) => s.status === 'open')

  return (
    <div>
      <PageHead title="Manual attendance editor" sub="Open sessions only — every change stores who and why" />

      <div className="mb-5 flex flex-wrap gap-3">
        <select className="input max-w-xs" value={courseId}
          onChange={(e) => { setSessions(null); setParams({ course: e.target.value }) }}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <select className="input max-w-xs" value={sessionId} disabled={!sessions}
          onChange={(e) => setParams({ course: courseId, session: e.target.value })}>
          <option value="">— pick session —</option>
          {openSessions.map((s) => (
            <option key={s.id} value={s.id}>{s.date} · open · {s.present_count}/{s.enrolled_count}</option>
          ))}
        </select>
        {!openSessions.length && sessions &&
          <span className="self-center text-[13px] text-slate-400">No open sessions — start one from the course page.</span>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {rowError && <div className="alert alert-error">{rowError}</div>}

      {!data && sessionId && <Spinner />}
      {data && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Status</th><th>Method / reason</th><th className="text-right">Change</th></tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.enrollment_id}>
                  <td>
                    <b>{row.name}</b>
                    <div className="text-xs text-slate-400">{row.student_id}</div>
                  </td>
                  <td><Badge v={row.status} /></td>
                  <td className="max-w-[220px]">
                    {row.edit_reason
                      ? <span className="text-[12.5px] text-slate-500">✍️ “{row.edit_reason}”</span>
                      : row.method === 'qr'
                        ? <span className="text-[12.5px] text-slate-400">📱 QR scan</span>
                        : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-right">
                    {editing?.key === row.enrollment_id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input className="input !w-56 !py-1.5 text-[13px]" autoFocus
                          placeholder="Reason (required)…"
                          value={editing.reason}
                          onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && save(row)} />
                        <button className="btn-dark btn-sm" onClick={() => save(row)}>Save</button>
                        <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    ) : data.session.status === 'open' ? (
                      <div className="flex justify-end gap-2">
                        <button className="btn-ghost btn-sm !text-emerald-700"
                          onClick={() => setEditing({ key: row.enrollment_id, status: 'present', reason: '' })}>
                          Present
                        </button>
                        <button className="btn-ghost btn-sm !text-red-600"
                          onClick={() => setEditing({ key: row.enrollment_id, status: 'absent', reason: '' })}>
                          Absent
                        </button>
                      </div>
                    ) : <span className="text-xs text-slate-300">frozen</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Empty title="No claimed students on this roster" />}
        </div>
      )}
    </div>
  )
}

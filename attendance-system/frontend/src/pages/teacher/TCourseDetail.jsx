import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errMsg } from '../../api'
import { PageHead, Spinner, Badge, Empty, ArmBtn, copyText } from '../../ui'

export default function TCourseDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null) // {course, roster}
  const [sessions, setSessions] = useState(null)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  function load() {
    api.get(`/courses/${id}/roster/`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)))
    api.get('/sessions/', { params: { course: id } }).then((r) => setSessions(r.data))
  }
  useEffect(() => { load() }, [id]) // eslint-disable-line

  async function importRoster(e) {
    e.preventDefault()
    setError(''); setBusy(true); setImportResult(null)
    try {
      let payload
      if (file) {
        const fd = new FormData(); fd.append('file', file); payload = fd
      } else {
        payload = { csv: csvText }
      }
      const { data } = await api.post(`/courses/${id}/roster/`, payload)
      setImportResult(data)
      setCsvText(''); setFile(null)
      load()
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  async function startSession() {
    setError('')
    try {
      await api.post('/sessions/', { course: Number(id) })
      load()
    } catch (err) {
      setError(errMsg(err)) // e.g. "already has an open session"
      load()
    }
  }

  async function closeSession(sid) {
    await api.post(`/sessions/${sid}/close/`)
    load()
  }

  async function resetDevice(enrollmentId) {
    await api.post(`/courses/${id}/reset-device/`, { enrollment_id: enrollmentId })
    load()
  }

  if (!data || !sessions) return <Spinner />
  const open = sessions.find((s) => s.status === 'open')

  return (
    <div>
      <PageHead title={`${data.course.code} — ${data.course.name}`}
        sub={`${data.roster.length} on roster · threshold ≥${data.course.eligibility_threshold}%`}>
        <Link to={`/t/eligibility?course=${id}`} className="btn-ghost btn-sm">Eligibility report</Link>
        {open ? (
          <Link to={`/t/sessions/${open.id}`} className="btn-dark btn-sm">Open QR screen ({open.present_count}/{open.enrolled_count})</Link>
        ) : (
          <button className="btn-dark btn-sm" onClick={startSession}>Start session</button>
        )}
      </PageHead>

      {error && <div className="alert alert-error">{error}</div>}

      {/* sessions */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="font-display font-bold">Sessions ({sessions.length})</h3>
          <span className="text-xs text-slate-400">Open sessions appear on your dashboard</span>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Status</th><th>Present</th><th></th></tr></thead>
            <tbody>
              {sessions.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.date}</td>
                  <td><Badge v={s.status} /></td>
                  <td className="font-semibold">{s.present_count} / {s.enrolled_count}</td>
                  <td className="text-right">
                    {s.status === 'open' && (
                      <>
                        <Link className="btn-ghost btn-sm" to={`/t/sessions/${s.id}`}>QR screen</Link>
                        <ArmBtn onConfirm={() => closeSession(s.id)}>Close session</ArmBtn>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && <Empty title="No sessions yet" sub="Start one to show the QR." />}
      </div>

      {/* roster */}
      <div className="card mb-6">
        <div className="px-5 pt-4"><h3 className="font-display font-bold">Roster &amp; claim codes</h3></div>
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student ID</th><th>Name</th><th>Status</th><th>Claim code</th><th>Device</th><th></th></tr></thead>
            <tbody>
              {data.roster.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[13px] font-semibold">{r.student_id}</td>
                  <td>{r.name}</td>
                  <td><Badge v={r.claimed ? 'claimed' : 'unclaimed'} /></td>
                  <td>
                    {r.claimed
                      ? <span className="text-slate-300">—</span>
                      : <button className="font-mono text-[13px] font-bold text-ink underline underline-offset-2"
                          onClick={() => copyText(r.claim_code)} title="Click to copy">
                          {r.claim_code}
                        </button>}
                  </td>
                  <td>{r.claimed ? (r.has_device ? '📱 registered' : <span className="text-slate-300">none</span>) : '—'}</td>
                  <td className="text-right">
                    {r.claimed && r.has_device &&
                      <ArmBtn onConfirm={() => resetDevice(r.id)}>Reset device</ArmBtn>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.roster.length === 0 && <Empty title="Empty roster" sub="Import a CSV below." />}
      </div>

      {/* import */}
      <div className="card p-5">
        <h3 className="font-display font-bold">Import roster CSV</h3>
        <p className="mt-1 text-[13px] text-slate-400">
          Columns: <code className="font-mono font-semibold">student_id,name</code> — a unique claim code is generated per row.
        </p>
        <form onSubmit={importRoster} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">CSV file</label>
            <input type="file" accept=".csv,text/csv" className="input !py-2"
              onChange={(e) => setFile(e.target.files[0] || null)} />
            <div className="my-2 text-center text-xs font-semibold text-slate-300">or paste</div>
            <textarea className="input font-mono text-[13px]" rows="4" placeholder={'2022-CS-011,Imran Qureshi\n2022-CS-012,Kamran Shah'}
              value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          </div>
          <div>
            <button className="btn-dark" disabled={busy || (!file && !csvText.trim())}>
              {busy ? 'Importing…' : 'Import'}
            </button>
            {importResult && (
              <div className="mt-4 rounded-xl border border-slate-200 p-3 text-[13px]">
                <b className="text-emerald-600">{importResult.created.length} created</b>
                {importResult.created.length > 0 && (
                  <ul className="mt-1 space-y-0.5 font-mono text-[12px]">
                    {importResult.created.map((c) => (
                      <li key={c.id}>{c.student_id} → <b>{c.claim_code}</b></li>
                    ))}
                  </ul>
                )}
                {importResult.skipped.length > 0 && (
                  <div className="mt-2 text-amber-600">
                    <b>{importResult.skipped.length} skipped:</b>{' '}
                    {importResult.skipped.map((s) => `row ${s.row} (${s.reason})`).join('; ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errMsg } from '../../api'
import { PageHead, Spinner, Badge, Progress, Empty } from '../../ui'

const FILTERS = [
  ['', 'All students'],
  ['eligible', 'Eligible'],
  ['at_risk', 'At risk'],
  ['not_eligible', 'Not eligible'],
]

export default function TEligibility() {
  const [params, setParams] = useSearchParams()
  const courseId = params.get('course') || ''
  const status = params.get('status') || ''
  const q = params.get('q') || ''

  const [courses, setCourses] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/courses/').then((r) => {
      setCourses(r.data)
      if (!courseId && r.data[0]) setParams({ course: String(r.data[0].id) }, { replace: true })
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    if (!courseId) return
    setData(null)
    api.get(`/courses/${courseId}/eligibility/`, { params: { status, q } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
  }, [courseId, status, q]) // eslint-disable-line

  async function exportCsv() {
    const res = await api.get(`/courses/${courseId}/eligibility/`,
      { params: { status, q, format: 'csv' }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data?.course?.code || 'course'}-eligibility.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  if (!courses) return <Spinner />

  return (
    <div>
      <PageHead title="Eligibility report" sub="Live exam eligibility per course">
        <button className="btn-dark btn-sm" onClick={exportCsv} disabled={!data}>Export CSV</button>
      </PageHead>

      <div className="mb-5 flex flex-wrap gap-3">
        <select className="input max-w-xs" value={courseId}
          onChange={(e) => setParams({ course: e.target.value, status, q })}>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <select className="input max-w-[180px]" value={status}
          onChange={(e) => setParams({ course: courseId, status: e.target.value, q })}>
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input max-w-[220px]" placeholder="Search name or ID…" value={q}
          onChange={(e) => setParams({ course: courseId, status, q: e.target.value })} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!data ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <div className="px-5 pt-4 text-[13px] text-slate-400">
            {data.course.code} · threshold ≥{data.threshold}% · {data.rows.length} students
          </div>
          <table className="table mt-2">
            <thead>
              <tr><th>Student</th><th>Present / held</th><th style={{ minWidth: 180 }}>Attendance</th>
                <th>Classes needed</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.enrollment_id}>
                  <td><b>{r.name}</b><div className="text-xs text-slate-400">{r.student_id}</div></td>
                  <td className="whitespace-nowrap font-semibold">{r.present} / {r.held}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Progress pct={r.percentage} status={r.status} />
                      <b className="w-14 text-right">{r.percentage == null ? '—' : r.percentage.toFixed(1) + '%'}</b>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-[13px] text-slate-500">
                    {r.status === 'eligible'
                      ? (r.can_miss > 0 ? `can miss ${r.can_miss}` : 'on the line')
                      : r.status === 'no_data' ? '—'
                      : `attend ${r.classes_needed} in a row`}
                  </td>
                  <td><Badge v={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Empty title="Nobody matches this filter" />}
        </div>
      )}
    </div>
  )
}

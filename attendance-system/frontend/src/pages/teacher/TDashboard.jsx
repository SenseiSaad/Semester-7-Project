import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageHead, Stat, Spinner, Badge, Empty } from '../../ui'

export default function TDashboard() {
  const [data, setData] = useState(null)
  const [openSessions, setOpenSessions] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([api.get('/courses/'), api.get('/sessions/')])
      .then(async ([c, s]) => {
        const courses = c.data
        const withRows = await Promise.all(courses.map(async (course) => {
          const { data } = await api.get(`/courses/${course.id}/eligibility/`)
          return { course, rows: data.rows }
        }))
        if (!alive) return
        setData(withRows)
        setOpenSessions(s.data.filter((x) => x.status === 'open'))
      })
      .catch((e) => alive && setData({ error: e }))
    return () => { alive = false }
  }, [])

  if (!data) return <Spinner />
  if (data.error) return <div className="alert alert-error">Backend unreachable: {String(data.error?.message || data.error)}</div>

  const students = new Set()
  let eligible = 0, atRisk = 0, notEligible = 0, pctSum = 0, pctN = 0
  data.forEach(({ rows }) => rows.forEach((r) => {
    students.add(r.student_id)
    if (r.status === 'eligible') eligible++
    else if (r.status === 'at_risk') atRisk++
    else if (r.status === 'not_eligible') notEligible++
    if (r.percentage != null) { pctSum += r.percentage; pctN++ }
  }))
  const avg = pctN ? (pctSum / pctN).toFixed(1) + '%' : '—'

  return (
    <div>
      <PageHead title="Dashboard" sub="Your courses at a glance">
        <Link to="/t/courses" className="btn-dark btn-sm">Courses</Link>
      </PageHead>

      {openSessions.length > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge b-open">Live</span>
            {openSessions.map((s) => (
              <Link key={s.id} to={`/t/sessions/${s.id}`}
                className="text-sm font-bold text-emerald-800 underline underline-offset-2">
                {s.course_code} session — {s.present_count}/{s.enrolled_count} present → open QR screen
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Courses" value={data.length} />
        <Stat label="Students" value={students.size} />
        <Stat label="Avg attendance" value={avg} />
        <Stat label="Not eligible" value={notEligible} sub={`${atRisk} at risk · ${eligible} eligible`} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">Courses</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map(({ course, rows }) => (
          <Link key={course.id} to={`/t/courses/${course.id}`} className="card block p-5 no-underline transition hover:shadow-lift">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-display text-xs font-bold tracking-widest text-slate-400">{course.code}</span>
                <h3 className="font-display text-lg font-bold">{course.name}</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                ≥{course.eligibility_threshold}%
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Badge v="eligible">{rows.filter((r) => r.status === 'eligible').length} ok</Badge>
              <Badge v="at_risk">{rows.filter((r) => r.status === 'at_risk').length} risk</Badge>
              <Badge v="not_eligible">{rows.filter((r) => r.status === 'not_eligible').length} out</Badge>
            </div>
          </Link>
        ))}
        {data.length === 0 && <Empty title="No courses yet" sub="Create one in Courses." />}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useAuth, useDB } from '../../auth'
import { PageHead, Stat, Badge, Progress, Empty } from '../../ui'
import { eligibilityStats } from '../../logic/eligibility.js'
import { presentCount } from '../../logic/courses.js'

const OK = '#5F8D5A', BAD = '#B4543F'

export default function TDashboard() {
  const { user } = useAuth()
  const db = useDB()

  const myCourses = db.courses // single-teacher demo: all courses belong to the admin
  const stats = myCourses.map((c) => ({ course: c, ...eligibilityStats(db, c.id) }))
  const openSessions = db.sessions.filter((s) => s.status === 'open')

  const students = new Set(db.enrollments.map((e) => e.studentId))
  const eligible = stats.reduce((a, s) => a + s.eligible, 0)
  const notEligible = stats.reduce((a, s) => a + s.notEligible, 0)
  const withAvg = stats.filter((s) => s.avg != null)
  const avg = withAvg.length ? withAvg.reduce((a, s) => a + s.avg, 0) / withAvg.length : null
  const total = eligible + notEligible

  const watchlist = stats
    .flatMap((s) => s.rows.map((r) => ({ ...r, course: s.course })))
    .filter((r) => r.percentage != null)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 5)

  return (
    <div>
      <PageHead title="Dashboard" sub={`Signed in as ${user.name}`}>
        <Link to="/t/courses" className="btn btn-dark btn-sm">Courses</Link>
      </PageHead>

      {openSessions.length > 0 && (
        <div className="mb-6 rounded-2xl border border-[var(--ok)] bg-[#DFE8D4] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge b-open">Live</span>
            {openSessions.map((s) => {
              const c = myCourses.find((x) => x.id === s.courseId)
              return (
                <Link key={s.id} to={`/t/sessions/${s.id}`}
                  className="text-sm font-bold text-[#44663F] underline underline-offset-2">
                  {c?.code} session — {presentCount(db, s.id)}/{db.enrollments.filter((e) => e.courseId === s.courseId).length} present → open session
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Courses" value={myCourses.length} />
        <Stat label="Students" value={students.size} />
        <Stat label="Avg attendance" value={avg == null ? '—' : avg.toFixed(1) + '%'} />
        <Stat label="Not eligible" value={notEligible} sub={`${eligible} eligible`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="card p-6">
          <h3 className="font-display text-lg tracking-wide">Eligibility distribution</h3>
          <div className="mt-5 flex items-center gap-7">
            <div className="donut" style={total ? {
              background: `conic-gradient(${OK} 0 ${eligible / total * 100}%, ${BAD} 0 100%)`,
            } : { background: '#DCD2BC' }}>
              <div className="donut-label">
                <b>{total ? Math.round(eligible / total * 100) + '%' : '—'}</b>
                <span>eligible</span>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5"><span className="legend-dot" style={{ background: OK }} />Eligible<b className="ml-auto pl-6">{eligible}</b></div>
              <div className="flex items-center gap-2.5"><span className="legend-dot" style={{ background: BAD }} />Not eligible<b className="ml-auto pl-6">{notEligible}</b></div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display text-lg tracking-wide">Average attendance by course</h3>
          <div className="mt-5 space-y-4">
            {stats.map(({ course, avg: p }) => (
              <div key={course.id} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-display text-xs tracking-widest text-stone">{course.code}</span>
                <div className={`progress flex-1 ${p == null ? '' : p >= course.eligibilityThreshold ? 'p-ok' : 'p-bad'}`}>
                  <i style={{ width: `${p == null ? 0 : Math.min(100, p)}%` }} />
                </div>
                <b className="w-14 text-right text-sm">{p == null ? '—' : p.toFixed(1) + '%'}</b>
              </div>
            ))}
            {stats.length === 0 && <Empty title="No courses yet" />}
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <div className="px-5 pt-4">
          <h3 className="font-display text-lg tracking-wide">Watchlist — below the line first</h3>
          <p className="mt-0.5 text-[13px] text-stone">Lowest attendance across all courses</p>
        </div>
        <table className="table mt-2">
          <thead><tr><th>Student</th><th>Course</th><th style={{ minWidth: 170 }}>Attendance</th><th>Missed</th><th>Status</th></tr></thead>
          <tbody>
            {watchlist.map((r) => (
              <tr key={r.studentId + r.course.id}>
                <td><b>{r.name}</b><div className="text-xs text-stone">{r.rollNo}</div></td>
                <td className="font-semibold">{r.course.code}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Progress pct={r.percentage} ok={r.eligible} />
                    <b className="w-14 text-right">{r.percentage.toFixed(1)}%</b>
                  </div>
                </td>
                <td className="font-semibold">{r.missedClasses}</td>
                <td><Badge v={r.eligible ? 'eligible' : 'not_eligible'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {watchlist.length === 0 && <Empty title="No attendance data yet" />}
      </div>

      <h2 className="mb-3 mt-8 font-display text-2xl tracking-wide">Courses</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ course, eligible: ok, notEligible: out, rows }) => (
          <Link key={course.id} to={`/t/courses/${course.id}`} className="card block p-5 no-underline transition hover:shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-bronze">{course.code}</span>
                <h3 className="font-display text-lg tracking-wide">{course.name}</h3>
              </div>
              <span className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-bold text-stone">
                ≥{course.eligibilityThreshold}%
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Badge v="eligible">{ok} ok</Badge>
              <Badge v="not_eligible">{out} out</Badge>
            </div>
            <div className="mt-3"><Progress pct={rows.length && rows[0].percentage != null ? (rows.reduce((a, r) => a + (r.percentage || 0), 0) / rows.filter((r) => r.percentage != null).length) : 0} ok /></div>
          </Link>
        ))}
        {stats.length === 0 && <Empty title="No courses yet" sub="Create one in Courses." />}
      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useAuth, useDB } from '../../auth'
import { PageHead, Badge, Progress, Empty } from '../../ui'
import { getStudentCourseSummary, courseOf } from '../../logic/eligibility.js'

export default function SDashboard() {
  const { user } = useAuth()
  const db = useDB()

  const courses = db.enrollments
    .filter((e) => e.studentId === user.id)
    .map((e) => ({ course: courseOf(db, e.courseId), summary: getStudentCourseSummary(db, user.id, e.courseId) }))
    .filter((x) => x.course)

  const withPct = courses.filter((c) => c.summary.percentage != null)
  const overall = withPct.length ? withPct.reduce((a, c) => a + c.summary.percentage, 0) / withPct.length : null
  const nOk = courses.filter((c) => c.summary.eligible).length
  const nOut = courses.length - nOk
  const attended = withPct.reduce((a, c) => a + c.summary.present, 0)

  return (
    <div>
      <PageHead title="My attendance" sub={`Where ${user.name.split(' ')[0]} stands for the final exam, per course`}>
        <Link to="/scan" className="btn btn-dark btn-sm">Scan attendance</Link>
      </PageHead>

      {courses.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card p-4 text-center">
            <div className="stat-value">{overall == null ? '—' : overall.toFixed(1) + '%'}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-stone">Overall</div>
          </div>
          <div className="card p-4 text-center">
            <div className="stat-value text-ok">{nOk}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-stone">Eligible</div>
          </div>
          <div className="card p-4 text-center">
            <div className={`stat-value ${nOut ? 'text-bad' : ''}`}>{nOut}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-stone">Not eligible</div>
          </div>
          <div className="card p-4 text-center">
            <div className="stat-value">{attended}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-stone">Classes attended</div>
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="card">
          <Empty title="Not enrolled in any course yet"
            sub="Your teacher adds students to a course roster — then it appears here." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map(({ course, summary: s }) => (
            <div key={course.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-widest text-bronze">{course.code}</span>
                  <h3 className="font-display text-lg tracking-wide">{course.name}</h3>
                </div>
                <Badge v={s.eligible ? 'eligible' : 'not_eligible'} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="stat-value">{s.percentage == null ? '—' : s.percentage.toFixed(1) + '%'}</span>
                <span className="text-[12px] font-semibold text-stone">
                  {s.present} / {s.held} · need ≥{s.threshold}%
                </span>
              </div>
              <div className="mt-2"><Progress pct={s.percentage} ok={s.eligible} /></div>
              <div className="mt-3 rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px] font-medium text-stone">
                {s.percentage == null
                  ? 'No sessions recorded yet.'
                  : s.eligible
                    ? `Eligible — ${s.missedClasses} class${s.missedClasses === 1 ? '' : 'es'} missed so far.`
                    : `Not eligible — ${s.missedClasses} class${s.missedClasses === 1 ? '' : 'es'} missed, below the ${s.threshold}% line.`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

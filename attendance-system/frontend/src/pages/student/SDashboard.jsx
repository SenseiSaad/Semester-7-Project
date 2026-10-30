import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PageHead, Spinner, Badge, Progress, Empty } from '../../ui'

export default function SDashboard() {
  const [courses, setCourses] = useState(null)

  useEffect(() => {
    api.get('/me/summary/').then((r) => setCourses(r.data.courses))
  }, [])

  if (!courses) return <Spinner />

  return (
    <div>
      <PageHead title="My attendance" sub="Where you stand for the final exam, per course">
        <Link to="/s/scan" className="btn-dark btn-sm">Scan attendance</Link>
      </PageHead>

      {courses.length === 0 ? (
        <div className="card">
          <Empty title="No courses yet"
            sub="Ask your teacher for a claim code, then sign up on the landing page." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <div key={c.course_id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-display text-xs font-bold tracking-widest text-slate-400">{c.code}</span>
                  <h3 className="font-display text-lg font-bold leading-tight">{c.name}</h3>
                </div>
                <Badge v={c.status} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="font-display text-3xl font-bold tracking-tight">
                  {c.percentage == null ? '—' : c.percentage.toFixed(1) + '%'}
                </span>
                <span className="text-[12px] font-semibold text-slate-400">
                  {c.present} / {c.held} classes · need ≥{c.threshold}%
                </span>
              </div>
              <div className="mt-2"><Progress pct={c.percentage} status={c.status} /></div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] font-medium text-slate-600">
                {c.status === 'eligible' && (c.can_miss > 0
                  ? `✓ Buffer: you can miss ${c.can_miss} more class${c.can_miss === 1 ? '' : 'es'} and stay eligible.`
                  : '✓ Exactly on the line — attend everything from here.')}
                {c.status === 'at_risk' &&
                  `⚠ Condonation case. Attend the next ${c.classes_needed} class${c.classes_needed === 1 ? '' : 'es'} in a row to reach ${c.threshold}%.`}
                {c.status === 'not_eligible' &&
                  `⛔ Below ${c.threshold - 5}%. Meet your advisor — recovering needs ${c.classes_needed} class${c.classes_needed === 1 ? '' : 'es'} in a row.`}
                {c.status === 'no_data' && 'No sessions recorded yet.'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

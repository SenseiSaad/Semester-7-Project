import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDB } from '../../auth'
import { PageHead, Badge, Progress, Empty } from '../../ui'
import { eligibilityStats, exportEligibilityCSV, courseOf } from '../../logic/eligibility.js'

export default function TEligibility() {
  const [params, setParams] = useSearchParams()
  const courseId = params.get('course') || ''
  const status = params.get('status') || ''
  const q = (params.get('q') || '').toLowerCase()
  const db = useDB()

  const course = courseId ? courseOf(db, courseId) : null
  const stats = courseId ? eligibilityStats(db, courseId) : null

  if (!db.courses.length) {
    return (
      <div>
        <PageHead title="Eligibility report" />
        <div className="card"><Empty title="No courses yet" sub="Create a course first." /></div>
      </div>
    )
  }

  const activeCourse = course || db.courses[0]
  const activeStats = courseId === activeCourse.id ? stats : eligibilityStats(db, activeCourse.id)

  function download() {
    const { filename, text } = exportEligibilityCSV(db, activeCourse.id)
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(a.href)
  }

  function set(next) { setParams({ course: activeCourse.id, ...next }) }

  const chips = [
    ['', 'All', activeStats.rows.length],
    ['eligible', 'Eligible', activeStats.eligible],
    ['not_eligible', 'Not eligible', activeStats.notEligible],
  ]

  const rows = activeStats.rows
    .filter((r) => !status || (status === 'eligible' ? r.eligible : !r.eligible))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.rollNo.toLowerCase().includes(q))

  return (
    <div>
      <PageHead title="Eligibility report" sub={`Percentage = present ÷ sessions held · threshold ≥${activeCourse.eligibilityThreshold}%`}>
        <button className="btn btn-dark btn-sm" onClick={download}>Export CSV</button>
      </PageHead>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select className="input max-w-xs" value={activeCourse.id}
          onChange={(e) => set({ course: e.target.value })}>
          {db.courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <input className="input max-w-[220px]" placeholder="Search name or roll no…" value={q}
          onChange={(e) => set({ q: e.target.value })} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {chips.map(([v, label, count]) => (
          <button key={v || 'all'}
            onClick={() => set({ status: v })}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-bold transition ${
              status === v ? 'border-strong bg-primary text-paper' : 'border-line bg-surface text-ink hover:border-strong'}`}>
            {label}
            <span className={`rounded-full px-1.5 text-[11px] ${status === v ? 'opacity-70' : 'bg-surface2 text-stone'}`}>{count}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-5 pt-4 text-[13px] text-stone">
          {activeCourse.code} · {activeStats.rows.length} students · {activeCourse.totalClasses ? `planned ${activeCourse.totalClasses} classes` : 'no plan set'}
        </div>
        <table className="table mt-2">
          <thead>
            <tr><th>Student</th><th>Present / held</th><th style={{ minWidth: 170 }}>Percentage</th><th>Missed</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td><b>{r.name}</b><div className="text-xs text-stone">{r.rollNo}</div></td>
                <td className="whitespace-nowrap font-semibold">{r.present} / {r.held}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <Progress pct={r.percentage} ok={r.eligible} />
                    <b className="w-14 text-right">{r.percentage == null ? '—' : r.percentage.toFixed(1) + '%'}</b>
                  </div>
                </td>
                <td className="font-semibold">{r.missedClasses}</td>
                <td><Badge v={r.eligible ? 'eligible' : 'not_eligible'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="Nobody matches this filter" />}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB, update } from '../../auth'
import { PageHead, Empty } from '../../ui'
import { addCourse } from '../../logic/courses.js'
import { eligibilityStats } from '../../logic/eligibility.js'
import { sessionsHeld } from '../../logic/eligibility.js'

export default function TCourses() {
  const db = useDB()
  const [form, setForm] = useState({ name: '', code: '', eligibilityThreshold: 75, totalClasses: 0 })
  const [error, setError] = useState('')

  function create(e) {
    e.preventDefault()
    setError('')
    let ok = false
    update((d) => {
      const res = addCourse(d, form)
      if (res.ok) { ok = true; setForm({ name: '', code: '', eligibilityThreshold: 75, totalClasses: 0 }) }
      else setError(res.error)
    })
    if (ok) setError('')
  }

  return (
    <div>
      <PageHead title="Courses" sub="Each course has its own roster, sessions and threshold" />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {db.courses.map((c) => {
            const { eligible, notEligible } = eligibilityStats(db, c.id)
            return (
              <Link key={c.id} to={`/t/courses/${c.id}`} className="card block p-5 no-underline transition hover:shadow-soft">
                <span className="text-[10.5px] font-bold uppercase tracking-widest text-bronze">{c.code}</span>
                <h3 className="font-display text-lg tracking-wide">{c.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold text-stone">
                  <span className="rounded-full bg-surface2 px-2.5 py-1">≥{c.eligibilityThreshold}% to pass</span>
                  <span className="rounded-full bg-surface2 px-2.5 py-1">{sessionsHeld(db, c.id)} sessions held</span>
                  <span className="rounded-full bg-surface2 px-2.5 py-1">{eligible + notEligible} students</span>
                </div>
              </Link>
            )
          })}
          {db.courses.length === 0 && <Empty title="No courses yet" sub="Create your first course on the right." />}
        </div>

        <form onSubmit={create} className="card h-fit p-5">
          <h3 className="font-display text-lg tracking-wide">New course</h3>
          {error && <div className="alert alert-error mt-3">{error}</div>}
          <div className="mt-4 space-y-3">
            <div><label className="label">Code</label>
              <input className="input" required placeholder="CS-310" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><label className="label">Name</label>
              <input className="input" required placeholder="Computer Networks" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Threshold %</label>
                <input className="input" type="number" min="1" max="99" required value={form.eligibilityThreshold}
                  onChange={(e) => setForm({ ...form, eligibilityThreshold: e.target.value })} /></div>
              <div><label className="label">Planned classes</label>
                <input className="input" type="number" min="0" value={form.totalClasses}
                  onChange={(e) => setForm({ ...form, totalClasses: e.target.value })} /></div>
            </div>
            <button className="btn btn-dark w-full">Create course</button>
          </div>
        </form>
      </div>
    </div>
  )
}

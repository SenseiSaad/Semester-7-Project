import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errMsg } from '../../api'
import { PageHead, Spinner, Empty } from '../../ui'

export default function TCourses() {
  const [courses, setCourses] = useState(null)
  const [form, setForm] = useState({ name: '', code: '', eligibility_threshold: 75 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get('/courses/').then((r) => setCourses(r.data)).catch((e) => setError(errMsg(e)))
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/courses/', { ...form, eligibility_threshold: Number(form.eligibility_threshold) })
      setForm({ name: '', code: '', eligibility_threshold: 75 })
      load()
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  if (!courses) return <Spinner />

  return (
    <div>
      <PageHead title="Courses" sub="Each course has its own roster, sessions and threshold" />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Link key={c.id} to={`/t/courses/${c.id}`} className="card block p-5 no-underline transition hover:shadow-lift">
              <span className="font-display text-xs font-bold tracking-widest text-slate-400">{c.code}</span>
              <h3 className="font-display text-lg font-bold">{c.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">≥{c.eligibility_threshold}% to pass</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{c.student_count} students</span>
              </div>
            </Link>
          ))}
          {courses.length === 0 && <Empty title="No courses yet" sub="Create your first course on the right." />}
        </div>

        <form onSubmit={create} className="card h-fit p-5">
          <h3 className="font-display font-bold">New course</h3>
          {error && <div className="alert alert-error mt-3">{error}</div>}
          <div className="mt-4 space-y-3">
            <div><label className="label">Code</label>
              <input className="input" required placeholder="CS-310" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><label className="label">Name</label>
              <input className="input" required placeholder="Computer Networks" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Eligibility threshold %</label>
              <input className="input" type="number" min="1" max="99" required value={form.eligibility_threshold}
                onChange={(e) => setForm({ ...form, eligibility_threshold: e.target.value })} /></div>
            <button className="btn-dark w-full" disabled={busy}>Create course</button>
          </div>
        </form>
      </div>
    </div>
  )
}

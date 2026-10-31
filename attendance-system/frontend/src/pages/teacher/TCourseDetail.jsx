import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDB, update } from '../../auth'
import { PageHead, Badge, Empty, ArmBtn } from '../../ui'
import { setThreshold, addStudentToCourse, getRoster, getSessions, presentCount } from '../../logic/courses.js'
import { sessionsHeld, courseOf } from '../../logic/eligibility.js'

export default function TCourseDetail() {
  const { id } = useParams()
  const db = useDB()
  const course = courseOf(db, id)
  const [studentForm, setStudentForm] = useState({ name: '', rollNo: '', email: '' })
  const [formError, setFormError] = useState('')
  const [thresholdDraft, setThresholdDraft] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  if (!course) return <div className="alert alert-error">Course not found. <Link to="/t/courses">Back to courses.</Link></div>

  const roster = getRoster(db, id)
  const sessions = getSessions(db, id)
  const open = sessions.find((s) => s.status === 'open')

  function saveThreshold() {
    update((d) => {
      const res = setThreshold(d, id, thresholdDraft)
      if (!res.ok) setFormError(res.error)
      else setFormError('')
    })
    setThresholdDraft(null)
  }

  function startSession() {
    update((d) => {
      // one open session per course at a time
      if (d.sessions.some((s) => s.courseId === id && s.status === 'open')) return
      const today = new Date().toISOString().slice(0, 10)
      d.sessions.push({ id: `s_${Date.now().toString(36)}`, courseId: id, date: today, status: 'open' })
    })
  }

  function closeSession(sid) { update((d) => { const s = d.sessions.find((x) => x.id === sid); if (s) s.status = 'closed' }) }

  function addStudent(e) {
    e.preventDefault()
    setFormError('')
    update((d) => {
      const res = addStudentToCourse(d, { courseId: id, ...studentForm, email: studentForm.email || `${studentForm.rollNo.toLowerCase()}@uni.edu` })
      if (res.ok) setStudentForm({ name: '', rollNo: '', email: '' })
      else setFormError(res.error)
    })
  }

  return (
    <div>
      <PageHead title={`${course.code} — ${course.name}`}
        sub={`${roster.length} students · ${sessionsHeld(db, id)} sessions held · planned ${course.totalClasses}`}>
        <Link to={`/t/eligibility?course=${id}`} className="btn btn-ghost btn-sm">Eligibility report</Link>
        {open ? (
          <Link to={`/t/sessions/${open.id}`} className="btn btn-dark btn-sm">Open session ({presentCount(db, open.id)}/{roster.length})</Link>
        ) : (
          <button className="btn btn-dark btn-sm" onClick={startSession}>Start session</button>
        )}
      </PageHead>

      {/* threshold editor — statuses recompute instantly on save */}
      <div className="card mb-6 p-5">
        <h3 className="font-display text-lg tracking-wide">Eligibility rule</h3>
        <p className="mt-1 text-[13px] text-stone">A student is eligible when their percentage is at or above this number. Changing it reclassifies everyone immediately.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">Eligible at</span>
          <input className="input !w-24 text-center" type="number" min="1" max="99"
            value={thresholdDraft ?? course.eligibilityThreshold}
            onChange={(e) => setThresholdDraft(e.target.value)} />
          <span className="text-sm font-semibold">% or more</span>
          <button className="btn btn-dark btn-sm" disabled={thresholdDraft == null} onClick={saveThreshold}>Apply</button>
          {formError && <span className="text-[13px] font-semibold text-bad">{formError}</span>}
        </div>
      </div>

      {/* sessions */}
      <div className="card mb-6">
        <div className="px-5 pt-4"><h3 className="font-display text-lg tracking-wide">Sessions ({sessions.length})</h3></div>
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Status</th><th>Present</th><th></th></tr></thead>
            <tbody>
              {sessions.slice(0, 10).map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.date}</td>
                  <td><Badge v={s.status} /></td>
                  <td className="font-semibold">{presentCount(db, s.id)} / {roster.length}</td>
                  <td className="text-right">
                    {s.status === 'open' ? (
                      <>
                        <Link className="btn btn-ghost btn-sm" to={`/t/sessions/${s.id}`}>Session screen</Link>
                        <ArmBtn onConfirm={() => closeSession(s.id)}>Close</ArmBtn>
                      </>
                    ) : (
                      <Link className="btn btn-ghost btn-sm" to={`/t/manual?session=${s.id}`}>Records</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && <Empty title="No sessions yet" sub="Start one to show the join QR." />}
      </div>

      {/* roster */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="font-display text-lg tracking-wide">Roster ({roster.length})</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(!showAdd)}>Add student</button>
        </div>
        {showAdd && (
          <form onSubmit={addStudent} className="mx-5 mt-4 grid gap-3 rounded-2xl border border-line bg-surface2 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <input className="input" required placeholder="Full name" value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })} />
            <input className="input" required placeholder="Roll no (2022-CS-011)" value={studentForm.rollNo}
              onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })} />
            <input className="input" placeholder="Email (optional)" value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} />
            <button className="btn btn-dark btn-sm">Add to roster</button>
            {formError && <div className="text-[13px] font-semibold text-bad md:col-span-4">{formError}</div>}
            <p className="text-[12px] text-stone md:col-span-4">A student account is created with the default password <b>study1234</b> — share it with the student.</p>
          </form>
        )}
        <div className="mt-2 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Roll no</th><th>Name</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {roster.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-[13px] font-semibold">{u.rollNo}</td>
                  <td>{u.name}</td>
                  <td className="text-stone">{u.email}</td>
                  <td className="text-right text-[12px] text-stone">password: study1234</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {roster.length === 0 && <Empty title="Empty roster" sub="Add students above." />}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHead, Spinner, Empty } from '../../ui'

const TYPE_LABEL = {
  device_shared: 'Device shared — used by a 2nd account in the session',
  unregistered_device: 'Scan from an unregistered device',
}

export default function TViolations() {
  const [courses, setCourses] = useState(null)
  const [courseId, setCourseId] = useState('')
  const [violations, setViolations] = useState(null)

  useEffect(() => {
    api.get('/courses/').then((r) => setCourses(r.data))
  }, [])

  useEffect(() => {
    setViolations(null)
    api.get('/violations/', { params: courseId ? { course: courseId } : {} })
      .then((r) => setViolations(r.data.violations))
  }, [courseId])

  if (!courses) return <Spinner />

  return (
    <div>
      <PageHead title="Violations log" sub="Anti-spoofing events. A student's 2nd violation in a course notifies you." />
      <select className="input mb-5 max-w-xs" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
        <option value="">All courses</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
      </select>

      {!violations ? <Spinner /> : violations.length === 0 ? (
        <div className="card"><Empty title="No violations 🎉" sub="Nobody has tried anything (yet)." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Student</th><th>Course</th><th>Session</th><th>Type</th></tr></thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap text-slate-500">{new Date(v.created_at).toLocaleString()}</td>
                  <td><b>{v.student_name}</b><div className="text-xs text-slate-400">{v.student_id}</div></td>
                  <td className="font-semibold">{v.course_code}</td>
                  <td className="text-slate-500">{v.session_date}</td>
                  <td className="max-w-[280px] text-[13px] font-medium text-red-600">
                    🚨 {TYPE_LABEL[v.type] || v.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useAuth, useDB } from '../../auth'
import { PageHead, Badge, Empty } from '../../ui'
import { courseOf } from '../../logic/eligibility.js'

export default function SHistory() {
  const { user } = useAuth()
  const db = useDB()

  const records = db.attendanceRecords
    .filter((r) => r.studentId === user.id)
    .map((r) => {
      const session = db.sessions.find((s) => s.id === r.sessionId)
      const course = session ? courseOf(db, session.courseId) : null
      return { ...r, courseCode: course?.code || '—', courseName: course?.name || '', sessionDate: session?.date || '' }
    })
    .sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div>
      <PageHead title="Attendance history" sub={`${records.length} records`} />
      {records.length === 0 ? (
        <div className="card"><Empty title="Nothing here yet" sub="Mark your first session from the Scan page." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Course</th><th>Status</th><th>Method</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.sessionDate}</td>
                  <td><b>{r.courseCode}</b> <span className="text-stone">{r.courseName}</span></td>
                  <td><Badge v={r.status} /></td>
                  <td className="text-stone">
                    {r.method === 'qr' ? 'QR token' : r.method === 'csv' ? 'CSV upload' : 'Manual'}
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

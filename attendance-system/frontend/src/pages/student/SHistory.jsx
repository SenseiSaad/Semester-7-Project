import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHead, Spinner, Badge, Empty } from '../../ui'

export default function SHistory() {
  const [records, setRecords] = useState(null)

  useEffect(() => {
    api.get('/attendance/history/').then((r) => setRecords(r.data.records))
  }, [])

  if (!records) return <Spinner />

  return (
    <div>
      <PageHead title="Attendance history" sub={`${records.length} records`} />
      {records.length === 0 ? (
        <div className="card"><Empty title="Nothing here yet" sub="Scan your first class QR." /></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Date</th><th>Course</th><th>Status</th><th>How</th><th>When</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.session ? r.marked_at.slice(0, 10) : '—'}</td>
                  <td className="font-semibold">{r.session?.course_code || '—'}</td>
                  <td><Badge v={r.status} /></td>
                  <td className="text-slate-500">
                    {r.method === 'qr' ? '📱 QR scan' : '✍️ manual'}
                    {r.edit_reason && <div className="text-xs text-slate-400">“{r.edit_reason}”</div>}
                  </td>
                  <td className="whitespace-nowrap text-slate-400">
                    {new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

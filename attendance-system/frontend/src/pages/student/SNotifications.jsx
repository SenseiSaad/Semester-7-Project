import { useEffect, useState } from 'react'
import { api } from '../../api'
import { PageHead, Spinner, Empty } from '../../ui'

export default function SNotifications() {
  const [data, setData] = useState(null)

  function load() {
    api.get('/notifications/').then(setData)
  }
  useEffect(() => { load() }, [])

  async function markRead(n) {
    if (n.read) return
    await api.post(`/notifications/${n.id}/read/`)
    load()
  }

  if (!data) return <Spinner />

  return (
    <div>
      <PageHead title="Notifications" sub={data.unread ? `${data.unread} unread` : 'All caught up'} />
      {data.notifications.length === 0 ? (
        <div className="card"><Empty title="Nothing yet" sub="Warnings and system messages appear here." /></div>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <button key={n.id} onClick={() => markRead(n)}
              className={`block w-full rounded-2xl border p-4 text-left text-sm transition ${
                n.read ? 'border-slate-200 bg-white text-slate-500' : 'border-ink bg-ink text-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{n.message}</span>
                {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
              </div>
              <div className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${n.read ? 'text-slate-300' : 'text-white/50'}`}>
                {new Date(n.created_at).toLocaleString()}{!n.read && ' · tap to mark read'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

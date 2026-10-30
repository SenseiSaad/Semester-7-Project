import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api, errMsg } from '../../api'
import { PageHead, Spinner, Badge, ArmBtn } from '../../ui'

/* Teacher session screen: rotating signed QR + live present count.
   Polls /sessions/{id}/qr/ every 5s (the code itself rotates every 20s)
   and the session detail for the live count. */
export default function TSession() {
  const { id } = useParams()
  const [qr, setQr] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const [q, d] = await Promise.all([
          api.get(`/sessions/${id}/qr/`),
          api.get(`/sessions/${id}/`),
        ])
        if (!alive) return
        setQr(q.data)
        setDetail(d.data)
        setError('')
        setSecondsLeft(q.data.valid_for)
      } catch (err) {
        if (!alive) return
        const d = err?.response?.data
        if (d?.detail?.includes('closed')) {
          // session got closed — reflect it and stop polling
          clearInterval(timer.current)
          try { setDetail((await api.get(`/sessions/${id}/`)).data) } catch { /* ignore */ }
          setQr(null)
        } else {
          setError(errMsg(err))
        }
      }
    }
    poll()
    timer.current = setInterval(poll, 5000)
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => { alive = false; clearInterval(timer.current); clearInterval(tick) }
  }, [id])

  if (!detail && !error) return <Spinner />
  if (error && !detail) {
    return (
      <div>
        <PageHead title="Session" />
        <div className="alert alert-error">{error}</div>
        <Link to="/t/courses" className="btn-ghost btn-sm">Back to courses</Link>
      </div>
    )
  }

  const s = detail.session
  const qrUrl = qr ? `${window.location.origin}${qr.url}` : ''

  return (
    <div>
      <PageHead title={`${s.course_code} — live session`} sub={s.date}>
        <Badge v={s.status} />
        <ArmBtn onConfirm={async () => { await api.post(`/sessions/${id}/close/`); setQr(null) }}>
          Close session
        </ArmBtn>
        <Link className="btn-ghost btn-sm" to={`/t/manual?session=${id}`}>Manual editor</Link>
      </PageHead>

      {error && <div className="alert alert-warn">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* QR side */}
        <div className={`card p-6 ${s.status === 'closed' ? 'opacity-40' : ''}`}>
          <div className="grid place-items-center rounded-2xl border-2 border-ink p-6">
            {qr ? (
              <>
                <div className="relative">
                  <QRCodeSVG value={qrUrl} size={232} level="M" includeMargin={false} />
                  <span className={`absolute -right-2 -top-2 h-4 w-4 rounded-full border-2 border-white ${secondsLeft > 5 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </div>
                <div className="mt-4 text-center">
                  <div className="font-display text-3xl font-bold tabular-nums">{secondsLeft}s</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    code re-signs automatically
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-sm font-semibold text-slate-400">
                Session closed — QR disabled
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-[13px] text-slate-400">
            Students scan this with their phone camera. The code is HMAC-signed with the
            session secret and dies after one rotation window.
          </p>
        </div>

        {/* live side */}
        <div className="card p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Present now</div>
              <div className="stat-value">{detail.present} <span className="text-xl text-slate-300">/ {detail.enrolled}</span></div>
            </div>
            <Link to={`/t/eligibility?course=${s.course}`} className="btn-ghost btn-sm">Eligibility</Link>
          </div>
          <div className="progress mt-3"><i style={{ width: `${detail.enrolled ? (detail.present / detail.enrolled) * 100 : 0}%` }} /></div>

          <h3 className="mb-2 mt-6 font-display font-bold">Marks</h3>
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {detail.records.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">No scans yet — show the QR.</p>
            )}
            {detail.records.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-sm">
                <span className="font-semibold">{r.student_name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  {r.method === 'qr' ? '📱 scan' : '✍️ manual'}
                  <Badge v={r.status} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

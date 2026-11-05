export function Badge({ v, children }) {
  const cls = {
    eligible: 'b-eligible', open: 'b-open', present: 'b-present',
    'not_eligible': 'b-not-eligible', absent: 'b-absent', bad: 'b-bad',
    at_risk: 'b-at_risk', warn: 'b-warn', unmarked: 'b-unmarked',
    closed: 'b-closed', no_data: 'b-muted',
  }[v] || 'b-muted'
  const label = children || {
    eligible: 'Eligible', not_eligible: 'Not eligible', open: 'Open', closed: 'Closed',
    present: 'Present', absent: 'Absent', unmarked: 'Unmarked',
  }[v] || v
  return <span className={`badge ${cls}`}>{label}</span>
}

export function Progress({ pct, ok }) {
  const tone = pct == null ? 'p-warn' : ok ? 'p-ok' : 'p-bad'
  return (
    <div className={`progress ${tone}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} />
    </div>
  )
}

export function Stat({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-stone">{label}</div>
      <div className="stat-value mt-1">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone">{sub}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm font-semibold text-stone">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />
      {label}
    </div>
  )
}

export function Empty({ title, sub }) {
  return (
    <div className="py-14 text-center">
      <b className="block font-display text-[15px] tracking-wide">{title}</b>
      {sub && <span className="text-sm text-stone">{sub}</span>}
    </div>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl tracking-wide">{title}</h1>
        {sub && <p className="mt-1 text-sm text-stone">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/* two-click destructive button — no native confirm() popups */
export function ArmBtn({ onConfirm, children, armed = 'Sure?', className = '' }) {
  return (
    <button
      className={`btn btn-ghost btn-sm ${className}`}
      onClick={(e) => {
        const b = e.currentTarget
        if (b.dataset.armed) { delete b.dataset.armed; onConfirm(); return }
        b.dataset.armed = '1'
        b.textContent = armed
        b.classList.add('!bg-[#F0DACF]', '!text-[#8A3B2C]', '!border-[var(--bad)]')
        setTimeout(() => {
          if (!b.isConnected) return
          delete b.dataset.armed
          b.textContent = children
          b.classList.remove('!bg-[#F0DACF]', '!text-[#8A3B2C]', '!border-[var(--bad)]')
        }, 2600)
      }}
    >
      {children}
    </button>
  )
}

export function copyText(s) { navigator.clipboard?.writeText(s) }

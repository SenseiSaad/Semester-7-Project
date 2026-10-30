export function Badge({ v, children }) {
  const label = children || {
    eligible: 'Eligible', at_risk: 'At risk', not_eligible: 'Not eligible',
    no_data: 'No data', open: 'Open', closed: 'Closed', present: 'Present',
    absent: 'Absent', unmarked: 'Unmarked', claimed: 'Claimed', unclaimed: 'Unclaimed',
  }[v] || v
  return <span className={`badge b-${v}`}>{label}</span>
}

export function Progress({ pct, status }) {
  return (
    <div className={`progress p-${status}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }} />
    </div>
  )
}

export function Stat({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="stat-value mt-1">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-16 text-sm font-semibold text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-ink" />
      {label}
    </div>
  )
}

export function Empty({ title, sub }) {
  return (
    <div className="py-14 text-center">
      <b className="block text-[15px]">{title}</b>
      {sub && <span className="text-sm text-slate-400">{sub}</span>}
    </div>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-400">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/* two-click destructive button — no native confirm() popups */
export function ArmBtn({ onConfirm, children, armed = 'Sure?', className = '' }) {
  let t
  return (
    <button
      className={`btn-ghost btn-sm ${className}`}
      onClick={(e) => {
        const b = e.currentTarget
        if (b.dataset.armed) { delete b.dataset.armed; onConfirm(); return }
        b.dataset.armed = '1'
        b.textContent = armed
        b.classList.add('!bg-red-50', '!text-red-600', '!border-red-200')
        t = setTimeout(() => {
          delete b.dataset.armed
          b.textContent = children
          b.classList.remove('!bg-red-50', '!text-red-600', '!border-red-200')
        }, 2600)
      }}
    >
      {children}
    </button>
  )
}

export function copyText(s) {
  navigator.clipboard?.writeText(s)
}

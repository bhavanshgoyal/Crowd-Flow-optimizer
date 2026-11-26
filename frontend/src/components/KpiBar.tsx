import { useStore } from '../store'

export default function KpiBar() {
  const k = useStore((s) => s.tick?.kpi)
  if (!k) {
    return (
      <div className="kpi-strip">
        <div className="kpi"><div className="label">Status</div><div className="value">Connecting…</div></div>
      </div>
    )
  }
  const cut = k.peak_rho_baseline > 0
    ? Math.round((1 - k.peak_rho_managed / k.peak_rho_baseline) * 100) : 0

  return (
    <div className="kpi-strip">
      <div className="kpi baseline">
        <div className="label">Peak ρ — no intervention</div>
        <div className="value">{k.peak_rho_baseline.toFixed(2)}<span className="unit">p/m²</span></div>
      </div>
      <div className="kpi managed">
        <div className="label">Peak ρ — with rerouting</div>
        <div className="value">{k.peak_rho_managed.toFixed(2)}<span className="unit">p/m²</span></div>
      </div>
      <div className="kpi reduction">
        <div className="label">Risk reduction</div>
        <div className="value">{cut}<span className="unit">%</span></div>
      </div>
      <div className="kpi"><div className="label">Cleared</div><div className="value">{k.cleared.toLocaleString()}</div></div>
      <div className="kpi"><div className="label">In venue</div><div className="value">{k.remaining.toLocaleString()}</div></div>
    </div>
  )
}

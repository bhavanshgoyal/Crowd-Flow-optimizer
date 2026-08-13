import { useStore } from '../store'

export function AlertsPanel() {
  const tick = useStore((s) => s.tick)
  return (
    <div className="panel">
      <div className="panel-head"><h3>Predicted incidents</h3><span className="meta">horizon 120s</span></div>
      {!tick && <p style={{ padding: 'var(--sp-3)', fontFamily: 'var(--body)', fontSize: 13, color: 'var(--c3)' }}>Connecting…</p>}
      {tick && tick.alerts.length === 0 && (
        <p style={{ padding: 'var(--sp-3)', fontFamily: 'var(--body)', fontSize: 13, color: 'var(--c3)' }}>
          No breach predicted in the next 120 seconds.
        </p>
      )}
      {tick?.alerts.map((a) => (
        <div key={a.zone} className="alert-card">
          <div className="alert-top"><span>{a.label}</span><span className="eta">in {a.eta_s}s</span></div>
          <div className="alert-rho">{a.predicted_rho.toFixed(2)} <span className="u">p/m²</span></div>
          <p className="alert-text">{a.text}</p>
          <div className="alert-action">→ {a.action}</div>
        </div>
      ))}
    </div>
  )
}

export function ZonesPanel() {
  const tick = useStore((s) => s.tick)
  return (
    <div className="panel">
      <div className="panel-head"><h3>Live zones</h3></div>
      <table className="zones">
        <thead><tr><th>Zone</th><th>p/m²</th><th>LOS</th><th>Status</th></tr></thead>
        <tbody>
          {tick?.zones.map((z) => (
            <tr key={z.id}>
              <td>{z.label}</td>
              <td className="num">{z.rho.toFixed(2)}</td>
              <td className="num">{z.los}</td>
              <td><span className={`pill ${z.risk}`}>{z.risk}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

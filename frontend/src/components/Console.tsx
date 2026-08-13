import { useStore } from '../store'
import VenueCanvas from '../canvas/VenueCanvas'
import { AlertsPanel, ZonesPanel } from './RiskPanel'
import KpiBar from './KpiBar'
import DensityChart from './DensityChart'
import Controls from './Controls'

export default function Console() {
  const venue = useStore((s) => s.venue)
  const t = useStore((s) => s.tick?.t)

  return (
    <div className="console" id="console">
      <div className="console-inner">
        <div className="console-top">
          <h2>Live control room{venue ? ` — ${venue.name}` : ''}</h2>
          <span className="live">
            <span className="dot"></span>
            {t !== undefined ? `t = ${t.toFixed(1)}s · twin sim running` : 'waiting for backend…'}
          </span>
        </div>

        <KpiBar />

        <div className="main">
          <div className="panel">
            <div className="panel-head">
              <h3>Venue — density &amp; flow</h3>
              <span className="meta">{venue ? `${venue.width_m}×${venue.height_m}m` : '—'}</span>
            </div>
            <div className="map-wrap">
              {venue ? <VenueCanvas /> : (
                <div style={{ padding: 'var(--sp-6)', fontFamily: 'var(--body)', fontSize: 13, color: 'var(--c3)' }}>
                  No venue loaded — start <code>backend/app.py</code> to see the live twin simulation here.
                </div>
              )}
            </div>
            <div className="legend-row">
              <span className="legend-item"><span className="swatch" style={{ background: 'var(--safe)' }}></span>SAFE &lt; 2.0</span>
              <span className="legend-item"><span className="swatch" style={{ background: 'var(--watch)' }}></span>WATCH 2.0–3.0</span>
              <span className="legend-item"><span className="swatch" style={{ background: 'var(--warning)' }}></span>WARNING 3.0–4.0</span>
              <span className="legend-item"><span className="swatch" style={{ background: 'var(--critical)' }}></span>CRITICAL 4.0–5.0</span>
              <span className="legend-item"><span className="swatch" style={{ background: 'var(--emergency)' }}></span>EMERGENCY &gt; 5.0</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <AlertsPanel />
            <ZonesPanel />
            <DensityChart />
            <Controls />
          </div>
        </div>
      </div>
    </div>
  )
}

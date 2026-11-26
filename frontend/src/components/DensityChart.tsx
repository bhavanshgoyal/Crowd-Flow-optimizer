import { useStore } from '../store'

const W = 400, H = 160
const RHO_MAX = 6 // chart ceiling, p/m^2

function y(rho: number) { return H - (Math.min(rho, RHO_MAX) / RHO_MAX) * H }

export default function DensityChart() {
  const history = useStore((s) => s.history)

  const baselinePts = history.map((h, i) => `${(i / Math.max(1, history.length - 1)) * W},${y(h.baseline)}`).join(' ')
  const managedPts = history.map((h, i) => `${(i / Math.max(1, history.length - 1)) * W},${y(h.managed)}`).join(' ')

  return (
    <div className="panel">
      <div className="panel-head"><h3>Peak density trend</h3></div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img"
          aria-label="Chart comparing baseline and managed peak density over time">
          <line x1="0" y1={y(4)} x2={W} y2={y(4)} stroke="#c93f3f" strokeOpacity="0.4" strokeDasharray="3 3" />
          <text x="4" y={y(4) - 4} className="zone-label" fill="#c93f3f" fillOpacity="0.75">crush risk 4.0</text>
          <line x1="0" y1={y(2)} x2={W} y2={y(2)} stroke="#c99a15" strokeOpacity="0.4" strokeDasharray="3 3" />
          <text x="4" y={y(2) - 4} className="zone-label" fill="#c99a15" fillOpacity="0.8">critical density 2.0</text>
          {history.length > 1 && (
            <>
              <polyline className="chart-line" fill="none" stroke="#c93f3f" strokeWidth="2.2" points={baselinePts} />
              <polyline className="chart-line d2" fill="none" stroke="#2f8a52" strokeWidth="2.2" points={managedPts} />
            </>
          )}
        </svg>
        <div className="chart-legend">
          <span><span className="sw" style={{ background: '#c93f3f' }}></span>No intervention</span>
          <span><span className="sw" style={{ background: '#2f8a52' }}></span>With rerouting</span>
        </div>
      </div>
    </div>
  )
}

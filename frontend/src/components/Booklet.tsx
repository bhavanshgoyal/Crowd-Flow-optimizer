import { useEffect } from 'react'

const LOS_ROWS: [string, string, string][] = [
  ['A', '> 3.24 m²', '< 0.31'],
  ['B', '2.32–3.24 m²', '0.31–0.43'],
  ['C', '1.39–2.32 m²', '0.43–0.72'],
  ['D', '0.93–1.39 m²', '0.72–1.08'],
  ['E', '0.46–0.93 m²', '1.08–2.17'],
  ['F', '< 0.46 m²', '> 2.17'],
]

const RISK_ROWS: { c: string; label: string; range: string; why: string }[] = [
  { c: 'var(--safe)', label: 'Safe', range: '< 2.0', why: 'Free flow.' },
  { c: 'var(--watch)', label: 'Watch', range: '2.0–3.0', why: 'Flow rate has already peaked.' },
  { c: 'var(--warning)', label: 'Warning', range: '3.0–4.0', why: 'Congestion building — act soon.' },
  { c: 'var(--critical)', label: 'Critical', range: '4.0–5.0', why: 'Crush risk (Helbing / IMO).' },
  { c: 'var(--emergency)', label: 'Emergency', range: '> 5.0', why: 'Independent movement is lost.' },
]

function Folio({ n, section }: { n: number; section: string }) {
  return <div className="book-folio"><span>{section}</span><span>{n.toString().padStart(2, '0')} / 06</span></div>
}

export default function Booklet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="booklet-overlay" role="dialog" aria-modal="true" aria-label="Case study: Sangam Ghat">
      <button className="booklet-close" onClick={onClose} aria-label="Close case study">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div className="booklet">
        <div className="book-cover">
          <span className="book-eyebrow">Case study</span>
          <h1 className="book-title">{'Sangam Ghat,\nMauni Amavasya'}</h1>
          <div className="book-meta">29 January 2025 — Prayagraj, India</div>
          <p className="book-lede">How a 78-second head start turns a crowd crush into an uneventful Tuesday.</p>
        </div>

        <div className="book-section">
          <Folio n={1} section="What happened" />
          <div className="book-col">
            <p>On the festival's biggest bathing day, an estimated 100 million pilgrims moved through Prayagraj. Pilgrims sleeping on the riverbank were trampled after others jumped barricades to reach the water. At least 30 people were killed, 60+ injured — the sixth crowd crush at Kumbh Mela in 70 years.</p>
          </div>
          <p className="book-quote">300 cameras and drones were already watching. None of them said what was about to happen.</p>
        </div>

        <div className="book-section">
          <Folio n={2} section="Why detection wasn't enough" />
          <div className="book-col">
            <p>Camera-based crowd analytics — CrowdVision and its peers — report density as it exists right now. That's real, and it's valuable. It's also exactly what was deployed at Sangam Ghat, and it didn't stop the crush. Knowing where a crowd <em>is</em> doesn't tell you where it's <em>going</em>.</p>
          </div>
        </div>

        <div className="book-section">
          <Folio n={3} section="The physics we used" />
          <div className="book-col">
            <p>Fruin's Level of Service scale (1987) — the standard cited in building codes and event-safety guidelines worldwide, not an invented threshold:</p>
          </div>
          <table className="book-table">
            <thead><tr><th>LOS</th><th>Area / person</th><th>Density (p/m²)</th></tr></thead>
            <tbody>{LOS_ROWS.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
          </table>
          <div className="book-formula">v(ρ) = v_free · [1 − exp(−γ(1/ρ − 1/ρ_max))], v_free = 1.34 m/s — Weidmann, 1993</div>
        </div>

        <div className="book-section">
          <Folio n={4} section="Risk bands" />
          {RISK_ROWS.map((r) => (
            <div className="book-legend-row" key={r.label}>
              <span className="lc" style={{ background: r.c }} />
              <b style={{ color: r.c }}>{r.label}</b>
              <span>{r.range} p/m² — {r.why}</span>
            </div>
          ))}
        </div>

        <div className="book-section">
          <Folio n={5} section="The warning" />
          <div className="book-stat">78s</div>
          <p className="book-stat-label">Gate 3 crossed into crush density (LOS F, &gt;4 p/m²) in the baseline run. The twin simulation — a ghost copy running 120 seconds ahead, refreshed every 3 seconds — saw it 78 seconds early. Not just an alarm: a fix. "Hold Stand A gates for 40 seconds. Open the Gate 5 corridor. Divert 30% of arrivals."</p>
        </div>

        <div className="book-section">
          <Folio n={6} section="The outcome" />
          <div className="book-kpis">
            <div className="book-kpi"><div className="v" style={{ color: 'var(--critical)' }}>4.62</div><div className="l">Peak ρ — no intervention</div></div>
            <div className="book-kpi"><div className="v" style={{ color: 'var(--safe)' }}>3.08</div><div className="l">Peak ρ — with rerouting</div></div>
            <div className="book-kpi"><div className="v" style={{ color: 'var(--brand-strong)' }}>33%</div><div className="l">Risk reduction</div></div>
            <div className="book-kpi"><div className="v">1,840</div><div className="l">Cleared</div></div>
          </div>
          <p className="book-quote">So the only thing anyone at Gate 3 felt was a slightly fuller walk to the water.</p>
        </div>

        <div className="book-section">
          <div className="book-sources">
            Fruin, <em>Pedestrian Planning and Design</em> (1987) · Weidmann (1993) · IMO evacuation guidance ·
            UK Purple Guide · G. Keith Still's DIM-ICE framework.
          </div>
          <div className="book-cta">
            <a className="btn primary" href="#console" onClick={onClose}>Open the live control room →</a>
          </div>
        </div>
      </div>
    </div>
  )
}

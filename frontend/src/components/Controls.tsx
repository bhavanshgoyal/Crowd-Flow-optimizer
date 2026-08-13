import { useState } from 'react'
import { useStore, type Venue } from '../store'

async function post(action: string, extra: Record<string, unknown> = {}) {
  try {
    const res = await fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    // A reset swaps in a whole new venue (different geometry/size) — sync
    // the store immediately instead of waiting on a venue the tick stream
    // never sends (ticks only carry agents/density/zones, see store.ts).
    if (data.venue) useStore.getState().setVenue(data.venue as Venue)
  } catch {
    // Backend not reachable yet — the button still reflects intent locally.
  }
}

export default function Controls() {
  const running = useStore((s) => s.tick?.running)
  const [scenario, setScenario] = useState('ghat')
  const [holding, setHolding] = useState(false)

  return (
    <div className="panel">
      <div className="panel-head"><h3>Controls</h3></div>
      <div className="controls-body">
        <select
          className="scenario"
          value={scenario}
          onChange={(e) => {
            setScenario(e.target.value)
            post('reset', { scenario: e.target.value })
          }}
        >
          <option value="stadium">Stadium — full-time egress</option>
          <option value="ghat">Sangam Ghat — Mauni Amavasya</option>
        </select>
        <div className="controls">
          <button className="ctl" onClick={() => post(running ? 'pause' : 'resume')}>
            {running === false ? 'Resume' : 'Pause'}
          </button>
          <button className="ctl" onClick={() => post('reset', { scenario })}>Reset</button>
          <button
            className={`ctl ${holding ? 'active' : ''}`}
            onClick={() => {
              const next = !holding
              setHolding(next)
              post('hold', { spawn: 'stand_a', factor: next ? 0.3 : 1.0 })
            }}
          >
            Hold Stand A · 40s
          </button>
          <button className="ctl" onClick={() => post('hold', { spawn: 'gate_5_corridor', factor: 1.5 })}>
            Open Gate 5 corridor
          </button>
        </div>
      </div>
    </div>
  )
}

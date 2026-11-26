import { useEffect, useRef, useState } from 'react'
import { apiUrl } from '../api'
import { useStore, type Venue } from '../store'

type ScenarioMeta = { id: string; name: string }

const FALLBACK_SCENARIOS: ScenarioMeta[] = [
  { id: 'stadium', name: 'Stadium — full-time egress' },
  { id: 'ghat', name: 'Sangam Ghat — Mauni Amavasya' },
]

const HOLD_DURATION_S = 40

async function post(action: string, extra: Record<string, unknown> = {}) {
  try {
    const res = await fetch(apiUrl('/api/control'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    if (data.venue) useStore.getState().setVenue(data.venue as Venue)
  } catch {
    // Backend not reachable yet — controls stay responsive locally.
  }
}

export default function Controls() {
  const tick = useStore((s) => s.tick)
  const venue = useStore((s) => s.venue)
  const running = tick?.running

  const [scenarios, setScenarios] = useState<ScenarioMeta[]>(FALLBACK_SCENARIOS)
  const [localScenario, setLocalScenario] = useState('stadium')
  const [localHolding, setLocalHolding] = useState(false)
  const [localCorridorOpen, setLocalCorridorOpen] = useState(false)
  const [holdRemaining, setHoldRemaining] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    fetch(apiUrl('/api/scenarios'))
      .then((r) => (r.ok ? r.json() : null))
      .then((list: ScenarioMeta[] | null) => {
        if (Array.isArray(list) && list.length > 0) setScenarios(list)
      })
      .catch(() => {})
  }, [])

  const clearHoldTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setHoldRemaining(null)
  }

  useEffect(() => () => clearHoldTimer(), [])

  const scenario = tick?.scenario ?? venue?.id ?? localScenario
  const serverHoldFactor = tick?.multipliers?.spawns?.stand_a
  const holding = serverHoldFactor !== undefined ? serverHoldFactor < 1.0 : localHolding

  const serverCorridorFactor = tick?.multipliers?.corridors?.gate_5_corridor
  const corridorOpen = serverCorridorFactor !== undefined ? serverCorridorFactor < 1.0 : localCorridorOpen

  const handleReset = (targetScenario: string) => {
    clearHoldTimer()
    setLocalHolding(false)
    setLocalCorridorOpen(false)
    post('reset', { scenario: targetScenario })
  }

  const toggleHold = () => {
    const next = !holding
    setLocalHolding(next)
    clearHoldTimer()
    post('hold', { spawn: 'stand_a', factor: next ? 0.3 : 1.0 })

    if (next) {
      let left = HOLD_DURATION_S
      setHoldRemaining(left)
      timerRef.current = window.setInterval(() => {
        left -= 1
        if (left <= 0) {
          clearHoldTimer()
          setLocalHolding(false)
          post('hold', { spawn: 'stand_a', factor: 1.0 })
        } else {
          setHoldRemaining(left)
        }
      }, 1000)
    }
  }

  const toggleCorridor = () => {
    const next = !corridorOpen
    setLocalCorridorOpen(next)
    // factor < 1 makes Gate 5 corridor cheaper than base floor (1.0) so flow routes through it;
    // null removes the override and restores the scenario's base_multiplier (1.9).
    post('hold', { spawn: 'gate_5_corridor', factor: next ? 0.5 : null })
  }

  return (
    <div className="panel">
      <div className="panel-head"><h3>Controls</h3></div>
      <div className="controls-body">
        <select
          className="scenario"
          aria-label="Select venue scenario"
          value={scenario}
          onChange={(e) => {
            const next = e.target.value
            setLocalScenario(next)
            handleReset(next)
          }}
        >
          {scenarios.map((sc) => (
            <option key={sc.id} value={sc.id}>{sc.name}</option>
          ))}
        </select>
        <div className="controls">
          <button className="ctl" onClick={() => post(running ? 'pause' : 'resume')}>
            {running === false ? 'Resume' : 'Pause'}
          </button>
          <button className="ctl" onClick={() => handleReset(scenario)}>Reset</button>
          <button
            className={`ctl ${holding ? 'active' : ''}`}
            onClick={toggleHold}
          >
            {holding && holdRemaining !== null ? `Holding Stand A · ${holdRemaining}s` : 'Hold Stand A · 40s'}
          </button>
          <button
            className={`ctl ${corridorOpen ? 'active' : ''}`}
            onClick={toggleCorridor}
          >
            {corridorOpen ? 'Gate 5 corridor open' : 'Open Gate 5 corridor'}
          </button>
        </div>
      </div>
    </div>
  )
}

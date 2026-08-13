import { create } from 'zustand'

export type Zone = { id: string; label: string; rho: number; los: string; risk: string; n: number }
export type Alert = {
  zone: string; label: string; eta_s: number; predicted_rho: number
  severity: string; action: string; text: string
}
export type Tick = {
  t: number; running: boolean
  agents: number[][]
  density_w: number; density_h: number; density: number[]
  zones: Zone[]; alerts: Alert[]
  kpi: { peak_rho_baseline: number; peak_rho_managed: number; cleared: number; remaining: number }
}
export type Venue = {
  name: string; width_m: number; height_m: number
  obstacles: { x0: number; y0: number; x1: number; y1: number }[]
  zones: { id: string; label: string; x0: number; y0: number; x1: number; y1: number }[]
  goals: { id: string; x: number; y: number; width_m: number }[]
  spawns: { id: string; x: number; y: number; radius: number }[]
}

type S = {
  tick: Tick | null
  venue: Venue | null
  history: { t: number; managed: number; baseline: number }[]
  setTick: (t: Tick) => void
  setVenue: (v: Venue) => void
}

export const useStore = create<S>((set) => ({
  tick: null, venue: null, history: [],
  setVenue: (venue) => set({ venue, history: [] }),
  setTick: (tick) => set((s) => {
    const h = s.history
    const last = h[h.length - 1]
    const next = (!last || tick.t - last.t >= 1)
      ? [...h, {
          t: tick.t, managed: tick.kpi.peak_rho_managed,
          baseline: tick.kpi.peak_rho_baseline,
        }].slice(-120)
      : h
    return { tick, history: next }
  }),
}))

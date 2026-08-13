import { useEffect, useRef } from 'react'
import { useStore } from '../store'

// Risk colours are read from the same CSS custom properties the rest of the
// page uses (styles/tokens.css) — canvas fillStyle accepts oklch() directly
// in every browser this app targets, so there is exactly one place these
// five colours are ever defined.
function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function heatColour(v: number) {           // v is 0-255, 255 == 6 p/m^2
  const x = v / 255
  if (x < 0.33) return `oklch(58% 0.135 152 / ${(x * 0.9).toFixed(2)})`   // safe
  if (x < 0.5) return `oklch(76% 0.125 100 / ${(x * 0.9).toFixed(2)})`    // watch
  if (x < 0.66) return `oklch(62% 0.17 42 / ${(x * 0.95).toFixed(2)})`    // warning
  return `oklch(55% 0.19 24 / ${Math.min(1, x).toFixed(2)})`              // critical
}

export default function VenueCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const venue = useStore((s) => s.venue)
  const tick = useStore((s) => s.tick)

  useEffect(() => {
    const cv = ref.current
    if (!cv || !venue) return
    const ctx = cv.getContext('2d')!
    const dpr = window.devicePixelRatio || 1

    const cssW = cv.clientWidth
    const cssH = cssW * (venue.height_m / venue.width_m)
    cv.width = cssW * dpr
    cv.height = cssH * dpr
    cv.style.height = `${cssH}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const S = cssW / venue.width_m

    const risk = {
      safe: cssVar('--safe'), watch: cssVar('--watch'), warning: cssVar('--warning'),
      critical: cssVar('--critical'), emergency: cssVar('--emergency'),
    }

    ctx.clearRect(0, 0, cssW, cssH)
    ctx.fillStyle = cssVar('--e2') || '#fffcf5'
    ctx.fillRect(0, 0, cssW, cssH)

    // 1. heatmap
    if (tick?.density?.length) {
      const cw = (venue.width_m / tick.density_w) * S
      const ch = (venue.height_m / tick.density_h) * S
      for (let r = 0; r < tick.density_h; r++) {
        for (let c = 0; c < tick.density_w; c++) {
          const v = tick.density[r * tick.density_w + c]
          if (v < 8) continue
          ctx.fillStyle = heatColour(v)
          ctx.fillRect(c * cw, r * ch, cw + 1, ch + 1)
        }
      }
    }

    // 2. walls
    ctx.fillStyle = cssVar('--c2') || '#5F5E5A'
    venue.obstacles.forEach((o) =>
      ctx.fillRect(o.x0 * S, o.y0 * S, (o.x1 - o.x0) * S, (o.y1 - o.y0) * S))

    // 3. monitored zones, outlined in their current risk colour
    ctx.lineWidth = 2
    ctx.font = '12px "Martian Mono", monospace'
    venue.zones.forEach((z) => {
      const live = tick?.zones.find((s) => s.id === z.id)
      const colour = risk[(live?.risk as keyof typeof risk) ?? 'safe']
      ctx.strokeStyle = colour
      ctx.strokeRect(z.x0 * S, z.y0 * S, (z.x1 - z.x0) * S, (z.y1 - z.y0) * S)
      ctx.fillStyle = colour
      ctx.fillText(`${z.label} ${live ? live.rho.toFixed(1) : '0.0'}`,
        z.x0 * S + 4, z.y0 * S - 5)
    })

    // 4. exits
    ctx.fillStyle = cssVar('--link') || '#185FA5'
    venue.goals.forEach((g) => {
      ctx.beginPath()
      ctx.arc(g.x * S, g.y * S, (g.width_m / 2) * S, 0, Math.PI * 2)
      ctx.fill()
    })

    // 5. people — all drawn inside a single beginPath()/fill() pair; per-dot
    // fill() calls are ~20x slower and stutter at 1,500 points.
    if (tick?.agents?.length) {
      ctx.fillStyle = cssVar('--c1') ? `${cssVar('--c1')}` : 'rgba(38,33,92,0.8)'
      ctx.globalAlpha = 0.8
      const r = Math.max(1, 0.22 * S)
      ctx.beginPath()
      for (const [x, y] of tick.agents) {
        ctx.moveTo(x * S + r, y * S)
        ctx.arc(x * S, y * S, r, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }, [venue, tick])

  return <canvas ref={ref} className="w-full" style={{ borderRadius: 4, border: '1px solid var(--b1)', display: 'block' }} />
}

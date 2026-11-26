import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Booklet from './Booklet'

const BEATS = [
  {
    key: 0,
    prompt: 'SOURCED — public/images/sangam-ghat-hero.webp ("Sangam Ghat Golden Hour"): golden-hour wide shot, riverbank crowd of every age, warm marigold grade. Chosen over the alternate "Pro Shot" take because its sky matches --brand and its foreground (elderly man with a cane, women in red/yellow) matches the hero copy; Pro Shot\'s storm-grey sky fought the warm palette.',
    bg: 'linear-gradient(180deg, oklch(70% 0.1 68 / .1), transparent 35%), url(/images/sangam-ghat-hero.webp) center 40% / cover no-repeat',
    slate: 'SHOT 01 · RELAX\nSANGAM GHAT · DAWN',
    eyebrow: 'Crowd Flow Optimiser',
    line: <>Every festival should feel <em>exactly</em> like this.</>,
    sub: 'Grandparents, toddlers, everyone in between. Keep scrolling — this is the calm part.',
  },
  {
    key: 1,
    prompt: 'SOURCED — public/images/riverbank-heatmap-dusk.webp ("Riverbank Heat-Map Dusk"): same crowd at dusk, a translucent green-to-red density shimmer drifting over the densest cluster — matches the beat brief almost exactly.',
    bg: 'linear-gradient(180deg, oklch(20% 0.03 300 / .05), transparent 30%), url(/images/riverbank-heatmap-dusk.webp) center 42% / cover no-repeat',
    slate: 'SHOT 02 · WATCHING\nTHE TWIN SIMULATION',
    eyebrow: 'Underneath',
    line: <>Nobody in this frame can see what's <em>about</em> to happen.</>,
    sub: 'Something else already can — a forward simulation, running 120 seconds ahead, quietly.',
  },
  {
    key: 2,
    prompt: 'SOURCED — public/images/control-room-gate-split.webp ("Control Room / Sangam Gate Split"): regenerated after the first attempt baked in a red "SECURITY LEVEL: MAXIMUM" alarm and the wrong countdown. This version shows a calm operator with a plain amber "78s" desk readout, split against a warmly lit gate archway with a steward guiding the crowd through — correct number, no alarm styling.',
    bg: 'linear-gradient(180deg, oklch(20% 0.03 300 / .1), transparent 30%), url(/images/control-room-gate-split.webp) center 40% / cover no-repeat',
    slate: 'SHOT 03–04 · THE WAY OUT\nGATE 5 CORRIDOR OPENS',
    eyebrow: '78 seconds before it would have mattered',
    line: <>It already knew — and opened a <em>way out</em>.</>,
    sub: "A third of the crowd, rerouted before anyone felt crowded. That's the whole product.",
    stat: '78s',
  },
  {
    key: 3,
    prompt: 'SOURCED — public/images/sangam-ghat-resolved.webp ("Warmer 90-Minutes-Later Grade"): the ghat later in the evening, crowd seated calmly on the steps, boats moored, softer warmer light — reads as resolved and unhurried.',
    bg: 'linear-gradient(180deg, oklch(70% 0.1 68 / .08), transparent 30%), url(/images/sangam-ghat-resolved.webp) center 45% / cover no-repeat',
    slate: 'SHOT 05 · RELAX, AGAIN\nSANGAM GHAT · SAME DAY',
    eyebrow: 'So the only thing anyone felt —',
    line: <>— was a genuinely nice day out.</>,
    sub: "That's the whole pitch. Not a louder alarm. A quieter one, 90 seconds earlier.",
    cta: true,
  },
]

function CineHero() {
  const cineRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cine = cineRef.current
    const stage = stageRef.current
    if (!cine || !stage) return
    const beats = Array.from(stage.querySelectorAll<HTMLElement>('.cine-beat'))
    const bars = Array.from(stage.querySelectorAll<HTMLElement>('.cine-progress b'))
    const n = beats.length
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      beats.forEach((b, i) => { b.style.opacity = i === 0 ? '1' : '0' })
      if (hintRef.current) hintRef.current.style.display = 'none'
      return
    }

    let ticking = false
    function update() {
      ticking = false
      const rect = cine!.getBoundingClientRect()
      const total = cine!.offsetHeight - window.innerHeight
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1))
      const p = total > 0 ? scrolled / total : 0
      const pos = p * (n - 1)

      beats.forEach((b, i) => {
        const d = Math.abs(pos - i)
        b.style.opacity = Math.max(0, 1 - d).toFixed(3)
      })
      bars.forEach((bar, i) => {
        const seg = Math.min(1, Math.max(0, pos - i))
        bar.style.transform = `scaleX(${seg.toFixed(3)})`
      })
      if (hintRef.current) hintRef.current.style.opacity = p > 0.03 ? '0' : '1'
    }
    function onScroll() {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="cine" ref={cineRef} id="cine">
      <div className="cine-stage" ref={stageRef}>
        {BEATS.map((b, i) => (
          <div key={b.key} className={`cine-beat${i === 0 ? ' on-load' : ''}`} data-beat={b.key} data-prompt={b.prompt}>
            <div className="cine-media" style={{ background: b.bg }} />
            <div className="cine-scrim" />
            <div className="cine-slate" aria-hidden="true">
              {b.slate.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}
            </div>
            <div className="cine-body">
              <span className="cine-eyebrow">{b.eyebrow}</span>
              {b.stat && <div className="cine-stat">{b.stat}</div>}
              <h1 className="cine-line">{b.line}</h1>
              <p className="cine-sub">{b.sub}</p>
              {b.cta && (
                <div className="cine-cta">
                  <a className="btn primary" href="#console">See it predict a crush →</a>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="cine-progress" aria-hidden="true">
          {BEATS.map((b) => <i key={b.key}><b></b></i>)}
        </div>
        <div className="scroll-hint" ref={hintRef}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          Scroll
        </div>
      </div>
    </div>
  )
}

const KEY_ITEMS: { kc: string; label: string; why: string }[] = [
  { kc: 'var(--brand-strong)', label: 'Marigold', why: '"Do this next." Every button and active control — never used for a data value.' },
  { kc: 'oklch(45% 0.1 292)', label: 'Indigo', why: 'A link — takes you somewhere else on the page. Never an alarm, never a number.' },
  { kc: 'var(--safe)', label: 'Green — Safe', why: 'Under 2.0 people per m². Free movement. No action needed.' },
  { kc: 'var(--watch)', label: 'Amber — Watch', why: '2.0–3.0 p/m². Getting busy — the flow rate has already peaked. Worth a glance.' },
  { kc: 'var(--warning)', label: 'Orange — Warning', why: '3.0–4.0 p/m². Congestion building. Act soon, not urgently.' },
  { kc: 'var(--critical)', label: 'Red — Critical', why: '4.0–5.0 p/m². Crush risk per Helbing & the IMO. Act now.' },
  { kc: 'var(--emergency)', label: 'Deep violet-red — Emergency', why: 'Over 5.0 p/m². Independent movement is lost. The highest alarm this page has.' },
  { kc: 'var(--c2)', label: 'Plum-grey text', why: 'Just words. Text is never a signal — the five colors above are the only alarms on this page.' },
]

function ColorKey() {
  return (
    <div className="keysec">
      <div className="key-head">
        <span className="eyebrow">Reading this page</span>
        <h2>Eight colors. Each one only ever means one thing.</h2>
      </div>
      <div className="key-grid">
        {KEY_ITEMS.map((k) => (
          <div className="key-item" key={k.label} style={{ '--kc': k.kc } as CSSProperties}>
            <div className="sw-label">{k.label}</div>
            <div className="sw-why">{k.why}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  { n: '1 — Watch', h: 'It counts people, honestly.', p: 'A camera or a photo tells it how many people are arriving and how fast — the same way a steward would, just faster and all the time.' },
  { n: '2 — Predict', h: 'It plays the next two minutes forward.', p: 'Not what’s crowded now — what will be crowded, up to 120 seconds before it happens, using the same physics real crowd-safety engineers use.' },
  { n: '3 — Redirect', h: 'It says exactly what to do.', p: 'One plain sentence to a steward: which gate to hold, which route to open, and for how long. Not a dashboard to interpret — an instruction to follow.' },
]

function HowItWorks() {
  return (
    <div className="how" id="how">
      <div className="how-inner">
        <span className="eyebrow">In plain words</span>
        <h2>Three steps. No jargon required to understand any of them.</h2>
        <div className="how-steps">
          {STEPS.map((s) => (
            <div className="how-step" key={s.n}>
              <div className="n">{s.n}</div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const VIDEOS = [
  { grad: 'linear-gradient(135deg, oklch(32% 0.13 352), oklch(55% 0.19 24))', dur: '0:38', pending: 'Footage pending', src: 'Field footage', title: 'Sangam Ghat, 29 Jan 2025 — the incident this scenario models', icon: <><circle cx="50" cy="62" r="26" /><circle cx="50" cy="62" r="14" /><line x1="50" y1="10" x2="50" y2="36" /></> },
  { grad: 'linear-gradient(135deg, oklch(45% 0.1 292), oklch(65% 0.09 292))', dur: '6 min read', pending: 'Read now', src: 'Case study', title: 'How a bathing queue becomes a crush — density over time', icon: <><path d="M20 70 L40 45 L55 58 L80 25" /><circle cx="80" cy="25" r="4" fill="#fff" stroke="none" /></>, isBooklet: true },
  { grad: 'linear-gradient(135deg, oklch(54% 0.15 48), oklch(70% 0.16 68))', dur: '1:05', pending: 'Footage pending', src: 'Product demo', title: 'Baseline vs. managed twin — watch the reroute happen', icon: <><rect x="18" y="30" width="30" height="30" /><rect x="54" y="30" width="30" height="30" /><line x1="48" y1="45" x2="54" y2="45" /></> },
  { grad: 'linear-gradient(135deg, oklch(58% 0.135 152), oklch(76% 0.125 100))', dur: '4:20', pending: 'Footage pending', src: 'Expert briefing', title: "Why DIM-ICE and Fruin's LOS still hold up in 2026", icon: <><circle cx="50" cy="38" r="14" /><path d="M26 82 Q50 58 74 82" /></> },
]

function VideoRail({ onOpenCaseStudy }: { onOpenCaseStudy: () => void }) {
  return (
    <div className="section">
      <div className="section-head">
        <h2>Related coverage</h2>
        <p>Real footage &amp; explainers — generated once video access is connected, script locked now</p>
      </div>
      <div className="video-rail">
        {VIDEOS.map((v) => {
          const handleOpen = v.isBooklet ? onOpenCaseStudy : undefined
          return (
            <div
              className="video-card" tabIndex={0} role="button"
              aria-label={v.isBooklet ? `Read: ${v.title}` : `Play: ${v.title}`}
              key={v.title}
              onClick={handleOpen}
              onKeyDown={handleOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen() } } : undefined}
            >
              <div className="video-poster" style={{ background: v.grad }}>
                <span className="video-pending">{v.pending}</span>
                <svg viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth="3" strokeOpacity=".55">{v.icon}</svg>
                <span className="play-btn"><svg viewBox="0 0 24 24" fill="#2a2136"><path d="M8 5v14l11-7z" /></svg></span>
                <span className="video-duration">{v.dur}</span>
              </div>
              <div className="video-meta"><div className="src">{v.src}</div><div className="title">{v.title}</div></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Landing() {
  const [caseStudyOpen, setCaseStudyOpen] = useState(false)

  return (
    <>
      <div className="topbar">
        <span className="wordmark">Crowd Flow <span>Optimiser</span></span>
        <nav>
          <a href="#how">How it works</a>
          <a href="#console">Live control room</a>
        </nav>
      </div>
      <CineHero />
      <ColorKey />
      <HowItWorks />
      <VideoRail onOpenCaseStudy={() => setCaseStudyOpen(true)} />
      <Booklet open={caseStudyOpen} onClose={() => setCaseStudyOpen(false)} />
    </>
  )
}

import { useSocket } from './useSocket'
import Landing from './components/Landing'
import Console from './components/Console'

export default function App() {
  useSocket()

  return (
    <>
      <Landing />
      <Console />
      <p className="footnote">
        Type is <code>Martian Grotesk</code> / <code>Martian Grotesk Condensed</code> / <code>Martian Mono</code>,
        evilmartians.com's own open-source typefaces (OFL-1.1), embedded as base64 so the app needs nothing from a
        font CDN. Color is OKLCH tokens grouped by job (elevation / border / content / UI / data) — see the color
        key above the fold for what each one means. Layout is deliberately not centered: prose pins to a 640px left
        rail, instrument sections widen to 1360px. Every spacing value is a multiple of the 8px scale. The cinematic
        hero's four beats now run real photography, sourced and picked against each beat's own brief — see each
        beat's <code>data-prompt</code> for why that shot and not another. The case study under "Related coverage"
        opens as a real read, not a placeholder; the other three "related coverage" cards are still gradient
        stand-ins pending video-generation credits. The live control room below connects to <code>/ws</code> and
        <code>/api/venue</code> — run <code>backend/app.py</code> to see it populate.
      </p>
    </>
  )
}

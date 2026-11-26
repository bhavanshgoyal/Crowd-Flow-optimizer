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
        Physics &amp; thresholds: Weidmann fundamental speed diagram (1993, <code>v_free = 1.34 m/s</code>,{' '}
        <code>ρ_max = 5.4 p/m²</code>), Fruin Level of Service bands (1987, LOS F &gt; <code>2.17 p/m²</code>),
        and Helbing / IMO evacuation crush threshold (<code>4.0 p/m²</code>). Twin simulation compares shortest-path
        baseline routing (<code>k = 0</code>) against congestion-aware Dijkstra flow fields (<code>k = 3</code>) with a
        120-second lookahead forecast and RT-DETR camera calibration.
      </p>
    </>
  )
}

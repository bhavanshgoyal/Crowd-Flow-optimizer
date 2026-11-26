import { useEffect, useState } from 'react'
import { apiUrl } from '../api'
import { useStore } from '../store'

type DetectionBox = { x: number; y: number; w: number; h: number; score: number }
type CalibrateResult = {
  count: number
  boxes: DetectionBox[]
  width: number
  height: number
  model: string
  observed_density: number
  arrival_rate: number
  spawn_id: string
}

export default function CalibratePanel() {
  const venue = useStore((s) => s.venue)
  const spawns = venue?.spawns

  const [spawnId, setSpawnId] = useState('stand_a')
  const [areaM2, setAreaM2] = useState('120')
  const [gateWidthM, setGateWidthM] = useState('4.0')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalibrateResult | null>(null)

  const activeSpawnId = spawns?.some((s) => s.id === spawnId)
    ? spawnId
    : (spawns?.[0]?.id ?? 'stand_a')

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const selectFile = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setResult(null)
    setError(null)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  const runCalibration = async (targetFile: File) => {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', targetFile)
      form.append('spawn_id', activeSpawnId)
      form.append('area_m2', String(Math.max(1, Number(areaM2) || 120)))
      form.append('gate_width_m', String(Math.max(0.5, Number(gateWidthM) || 4)))

      const res = await fetch(apiUrl('/api/calibrate'), { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Calibration failed (${res.status})`)
      }
      const data = (await res.json()) as CalibrateResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not calibrate from photo.')
    } finally {
      setBusy(false)
    }
  }

  const useSampleFrame = async () => {
    setError(null)
    try {
      const res = await fetch('/images/sangam-ghat-hero.webp')
      const blob = await res.blob()
      const sample = new File([blob], 'sangam-ghat-hero.webp', { type: blob.type || 'image/webp' })
      selectFile(sample)
      await runCalibration(sample)
    } catch {
      setError('Could not load sample frame.')
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Camera calibration — RT-DETR</h3>
        <span className="meta">POST /api/calibrate</span>
      </div>
      <div className="calibrate-body">
        <div className="cal-grid">
          <label className="cal-field">
            <span>Target spawn</span>
            <select
              className="scenario"
              value={activeSpawnId}
              onChange={(e) => setSpawnId(e.target.value)}
            >
              {spawns && spawns.length > 0 ? (
                spawns.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} ({s.rate_per_s ?? '?'} p/s)
                  </option>
                ))
              ) : (
                <option value="stand_a">stand_a</option>
              )}
            </select>
          </label>
          <label className="cal-field">
            <span>Observed area (m²)</span>
            <input
              type="number"
              min="1"
              step="10"
              value={areaM2}
              onChange={(e) => setAreaM2(e.target.value)}
            />
          </label>
          <label className="cal-field">
            <span>Gate width (m)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={gateWidthM}
              onChange={(e) => setGateWidthM(e.target.value)}
            />
          </label>
        </div>

        <div className="controls">
          <label className="ctl cal-upload">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            />
            {file ? file.name : 'Choose crowd photo…'}
          </label>
          <button
            className="ctl active"
            disabled={!file || busy}
            onClick={() => file && runCalibration(file)}
          >
            {busy ? 'Detecting…' : 'Calibrate arrival rate'}
          </button>
          <button className="ctl" disabled={busy} onClick={useSampleFrame}>
            Test sample frame
          </button>
        </div>

        {error && <p className="cal-error">{error}</p>}

        {(previewUrl || result) && (
          <div className="cal-result">
            {previewUrl && (
              <div className="cal-preview">
                <img src={previewUrl} alt="Calibration frame" />
                {result && result.boxes.length > 0 && (
                  <svg
                    className="cal-boxes"
                    viewBox={`0 0 ${result.width} ${result.height}`}
                    preserveAspectRatio="none"
                  >
                    {result.boxes.map((b, i) => (
                      <rect
                        key={i}
                        x={b.x}
                        y={b.y}
                        width={b.w}
                        height={b.h}
                        fill="none"
                        stroke="var(--brand)"
                        strokeWidth={Math.max(2, result.width * 0.004)}
                      />
                    ))}
                  </svg>
                )}
              </div>
            )}
            {result && (
              <div className="cal-stats">
                <div><span>Detected</span><b>{result.count} people</b></div>
                <div><span>Observed ρ</span><b>{result.observed_density.toFixed(2)} p/m²</b></div>
                <div><span>Applied rate ({result.spawn_id})</span><b>{result.arrival_rate.toFixed(2)} p/s</b></div>
                <div className="cal-model">Model: <code>{result.model}</code></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

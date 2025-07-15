// src/components/pages/InteractiveSurvivalCurvePage.tsx
import React, { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Brush,
} from 'recharts'

// ─── Types ─────────────────────────────────────────────────────
interface Row {
  time: number
  hazard: number
  n_event: number
  n_censor: number
  group: string
}

interface Cohort {
  name: string
  data: Row[]
}

interface ChartPoint {
  time: number
  [stratum: string]: number
}

// ─── Constants ────────────────────────────────────────────────
// filenames under public/data must match exactly
const CSV_FILES: { name: string; url: string }[] = [
  {
    name: 'UKBB Discovery',
    url: `${import.meta.env.BASE_URL}data/UKBB_discovery_surv.csv`,
  },
  {
    name: 'UKBB Validation',
    url: `${import.meta.env.BASE_URL}data/UKBB_validation_surv.csv`,
  },
  { name: 'MITS', url: `${import.meta.env.BASE_URL}data/MITS_surv.csv` },
  { name: 'SIT', url: `${import.meta.env.BASE_URL}data/SIT_surv.csv` },
]

// assign up to 4 distinct colors for your strata
const STRATUM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f97316']

// ─── Card & Tooltip ───────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-xl shadow-md p-6">{children}</div>
)

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-sm p-3 border rounded shadow-lg text-sm">
        <p className="font-semibold">Time: {label}</p>
        <ul className="mt-1 space-y-1">
          {payload.map((pt: any) => (
            <li key={pt.name} className="flex justify-between">
              <span style={{ color: pt.color }}>{pt.name}</span>
              <span className="font-mono">{pt.value.toFixed(3)}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return null
}

// ─── Main Page ────────────────────────────────────────────────
const InteractiveSurvivalCurvePage: React.FC = () => {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)

  // load all four CSVs in parallel
  useEffect(() => {
    let loaded: Cohort[] = []
    let failures = 0

    CSV_FILES.forEach(({ name, url }) => {
      Papa.parse<Row>(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (res.errors.length) {
            console.error(`✖ parse errors in ${name}:`, res.errors)
            failures++
          } else {
            loaded.push({ name, data: res.data })
          }
          // once all have either loaded or failed
          if (loaded.length + failures === CSV_FILES.length) {
            if (loaded.length) {
              setCohorts(loaded)
              setSelectedIdx(0)
            }
            if (failures) {
              setError('Some cohorts failed to load; check console.')
            }
            setLoading(false)
          }
        },
      })
    })
  }, [])

  const selected = cohorts[selectedIdx]

  // pivot to wide form: each unique time → one row, with a hazard column per stratum
  const chartData = useMemo<ChartPoint[]>(() => {
    if (!selected) return []
    const times = Array.from(new Set(selected.data.map((d) => d.time))).sort(
      (a, b) => a - b
    )
    return times.map((t) => {
      const row: ChartPoint = { time: t }
      selected.data
        .filter((d) => d.time === t)
        .forEach((d) => {
          row[d.group] = d.hazard
        })
      return row
    })
  }, [selected])

  // list of stratum names
  const strata = useMemo<string[]>(() => {
    if (!selected) return []
    return Array.from(new Set(selected.data.map((d) => d.group)))
  }, [selected])

  // determine the maximum hazard value so we can scale Y precisely
  const maxHazard = useMemo(() => {
    if (!chartData.length || !strata.length) return 0
    return Math.max(
      ...chartData.flatMap((pt) => strata.map((g) => pt[g] ?? 0))
    )
  }, [chartData, strata])

  if (loading) return <div className="p-6 text-center">Loading cohorts…</div>
  if (error)
    return (
      <div className="p-6 bg-red-50 text-red-600 rounded">{error}</div>
    )
  if (!selected)
    return <div className="p-6 text-gray-600">No cohorts available.</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-gray-900">
          Cumulative Hazard Curves
        </h1>

        {/* Cohort selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Cohort
          </label>
          <select
            className="w-full md:w-1/3 p-2 border rounded"
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(+e.target.value)}
          >
            {cohorts.map((c, i) => (
              <option key={c.name} value={i}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chart */}
        <Card>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />

              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                stroke="#475569"
                tick={{ fontSize: 12 }}
                label={{
                  value: 'Time',
                  position: 'insideBottom',
                  offset: -10,
                  dy: 20,
                  fill: '#475569',
                }}
              />

              <YAxis
                stroke="#475569"
                tick={{ fontSize: 12 }}
                // now exactly from 0 up to maxHazard, so small curves show clearly
                domain={[0, maxHazard]}
                label={{
                  value: 'Cumulative Hazard',
                  angle: -90,
                  position: 'insideLeft',
                  dx: -10,
                  fill: '#475569',
                }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />

              {strata.map((g, i) => (
                <Line
                  key={g}
                  dataKey={g}
                  name={g}
                  // linear join (not step)
                  type="monotone"
                  stroke={STRATUM_COLORS[i % STRATUM_COLORS.length]}
                  strokeWidth={2}
                  // show dots at points
                  dot={{ r: 3 }}
                />
              ))}

              <Brush
                dataKey="time"
                height={30}
                stroke="#3b82f6"
                y={350}
                travellerWidth={10}
                gap={4}
                fill="#f1f5f9"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}

export default InteractiveSurvivalCurvePage
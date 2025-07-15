// src/components/pages/InteractiveSurvivalCurvePage.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import Papa from 'papaparse';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  Line,
  Brush,
} from 'recharts';

// ─── Shared UI bits ─────────────────────────────────────────
const Card: React.FC<{ className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
    {children}
  </div>
);

const Header: React.FC = () => (
  <header className="text-center mb-6">
    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
      Interactive Survival Curve Viewer
    </h1>
    <p className="mt-2 text-lg text-slate-600">
      Kaplan–Meier survival by tertile group for each cohort
    </p>
  </header>
);

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartPoint;
  return (
    <div className="bg-white/90 p-3 rounded-lg shadow-lg border">
      <p className="font-bold">Time: {label}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {payload.map((entry: any) => {
          const base = entry.name;
          return (
            <li key={base} style={{ color: entry.color }}>
              <strong>{base}</strong>: survival={entry.value.toFixed(3)},&nbsp;
              events={row[`${base}_n_event`]}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ─── Types ─────────────────────────────────────────────────
interface RawPoint {
  time: number;
  hazard: number;   // actually survival probability
  n_event: number;
  group: string;
}
interface Cohort {
  name: string;
  data: RawPoint[];
}
interface Stratum {
  name: string;
  data: RawPoint[];
  color: string;
}
interface ChartPoint {
  time: number;
  [key: string]: number;
}

// ─── CSV List & Colors ─────────────────────────────────────
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
];
const STRATUM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f97316'];

// ─── Pivot helper ──────────────────────────────────────────
function mergeStrata(
  strataData: { name: string; data: RawPoint[] }[]
): ChartPoint[] {
  const times = new Set<number>();
  strataData.forEach((s) => s.data.forEach((p) => times.add(p.time)));
  const sorted = Array.from(times).sort((a, b) => a - b);
  return sorted.map((t) => {
    const pt: any = { time: t };
    strataData.forEach(({ name, data }) => {
      const row = data.find((p) => p.time === t) || {
        hazard: 1,
        n_event: 0,
      };
      // rename hazard → survival
      pt[name] = row.hazard;
      pt[`${name}_n_event`] = row.n_event;
    });
    return pt as ChartPoint;
  });
}

// ─── Main Page ─────────────────────────────────────────────
const InteractiveSurvivalCurvePage: React.FC = () => {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string>('');
  const [strata, setStrata] = useState<Stratum[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  // load CSVs
  useEffect(() => {
    let loaded: Cohort[] = [];
    let failed = 0;
    CSV_FILES.forEach(({ name, url }) => {
      Papa.parse<RawPoint>(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (res.errors.length) {
            console.error(`Error parsing ${name}:`, res.errors);
            failed++;
          } else {
            loaded.push({ name, data: res.data });
          }
          if (loaded.length + failed === CSV_FILES.length) {
            if (loaded.length) {
              setCohorts(loaded);
              setSelected(loaded[0].name);
            }
            if (failed) setError('Some cohorts failed to load.');
            setLoading(false);
          }
        },
      });
    });
  }, []);

  // build strata & chart on cohort change
  const buildChart = useCallback(() => {
    const c = cohorts.find((x) => x.name === selected);
    if (!c) return;
    const groups = Array.from(new Set(c.data.map((p) => p.group))).sort();
    const arr = groups.map((g, i) => ({
      name: g,
      data: c.data.filter((p) => p.group === g),
      color: STRATUM_COLORS[i % STRATUM_COLORS.length],
    }));
    setStrata(arr);
    setChartData(mergeStrata(arr));
  }, [cohorts, selected]);

  useEffect(() => {
    buildChart();
  }, [buildChart]);

  // Y‐axis domain hook (must run every render)
  const maxSurv = useMemo(() => {
    return 1; // survival always ≤1
  }, []);

  // early returns
  if (loading) {
    return <div className="p-10 text-center">Loading…</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded text-center">
        {error}
      </div>
    );
  }

  // main render
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Header />

        {/* Cohort selector */}
        <Card className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Cohort
          </label>
          <select
            className="w-full p-2 border rounded"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {cohorts.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Card>

        {/* Survival Curve */}
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            Kaplan–Meier Survival Curves
          </h3>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
                    dy: 10,
                    fill: '#475569',
                  }}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fontSize: 12 }}
                  domain={[0, 1]}
                  label={{
                    value: 'Survival Probability',
                    angle: -90,
                    position: 'insideLeft',
                    dx: -10,
                    fill: '#475569',
                  }}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" />
                {strata.map((s) => (
                  <Line
                    key={s.name}
                    type="stepAfter"
                    dataKey={s.name}
                    stroke={s.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                ))}
                <Brush
                  dataKey="time"
                  height={30}
                  stroke="#3b82f6"
                  y={350}
                  travellerWidth={15}
                  gap={5}
                  fill="#f1f5f9"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InteractiveSurvivalCurvePage;
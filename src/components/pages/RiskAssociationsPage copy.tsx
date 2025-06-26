import React, { useState, useEffect, useMemo } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { Input } from '../ui/input';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface RiskData {
  metabolic_trait: string;
  ukbb_measured: number | null;
  ukbb_predicted: number | null;
  sit_predicted: number | null;
  mits_predicted: number | null;
  ugced_predicted: number | null;
}

interface RiskComparisonResponse {
  title: string;
  description: string;
  data: RiskData[];
}

const PALETTE = ['#d4de9c', '#94c58f', '#86c7b4', '#9cd2ed', '#a992c0'];

const COHORTS: { key: keyof RiskData; label: string; color: string }[] = [
  { key: 'ukbb_measured', label: 'UKBB Measured', color: PALETTE[0] },
  { key: 'ukbb_predicted', label: 'UKBB Predicted', color: PALETTE[1] },
  { key: 'sit_predicted', label: 'SIT Predicted', color: PALETTE[2] },
  { key: 'mits_predicted', label: 'MITS Predicted', color: PALETTE[3] },
  { key: 'ugced_predicted', label: 'UGCED Predicted', color: PALETTE[4] },
];

export default function RiskAssociationsPage() {
  const [resp, setResp] = useState<RiskComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohorts, setSelectedCohorts] = useState<keyof RiskData[]>(
    COHORTS.map(c => c.key)
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/improved_risk_comparison.json`)
      .then(r => r.json())
      .then(setResp)
      .catch(e => { console.error(e); toast.error('Failed to load data'); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!resp) return [];
    return resp.data
      .filter(d => d.metabolic_trait !== 'Biomarker')
      .filter(d =>
        !searchTerm ||
        d.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [resp, searchTerm]);

  const chartData = useMemo(() => {
    return filtered.map(d => {
      const entry: any = { trait: d.metabolic_trait.replace(/_/g, ' ') };
      selectedCohorts.forEach(key => {
        entry[key] = d[key] ?? 0;
      });
      return entry;
    });
  }, [filtered, selectedCohorts]);

  const maxAbs = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map(d => Math.abs(d.value || 0)));
  }, [chartData]);

  const toggleCohort = (key: keyof RiskData) => {
    setSelectedCohorts(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const exportJSON = () => {
    if (!resp) return;
    const payload = {
      title: resp.title,
      description: resp.description,
      filtered_data: filtered,
      cohorts: selectedCohorts,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'risk_comparison.json'; a.click();
    URL.revokeObjectURL(url); toast.success('Data exported');
  };

  if (loading) return <div className="p-6 flex justify-center">Loading...</div>;
  if (!resp) return <div className="p-6 text-red-600">Failed to load data.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{resp.title}</h1>
          <p className="text-gray-600 mt-1">{resp.description}</p>
        </div>
        <button
          onClick={exportJSON}
          className="flex items-center bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
        >
          <Download className="w-5 h-5 mr-2" /> Export JSON
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Search Trait</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="e.g. HDL C"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700">Select Cohorts</label>
          <div className="mt-2 flex flex-wrap gap-4">
            {COHORTS.map(c => {
              const active = selectedCohorts.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleCohort(c.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition-colors focus:outline-none ${
                    active
                      ? 'text-white border-transparent'
                      : 'text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  style={
                    active
                      ? { backgroundColor: c.color }
                      : { backgroundColor: '#F3F4F6' }
                  }
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Risk Estimates by Trait</h2>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ width: Math.max(chartData.length * 80, 600) }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                barGap={2}
                maxBarSize={50}
                domain={['auto', 'auto']}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="trait" angle={-45} textAnchor="end" interval={0} height={60} />
                <YAxis domain={[-maxAbs, maxAbs]} />
                <Tooltip formatter={(value: number) => value.toFixed(3)} />
                <Legend verticalAlign="top" />
                {selectedCohorts.map((c, idx) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    name={COHORTS.find(x => x.key === c)?.label}
                    fill={COHORTS.find(x => x.key === c)?.color}
                    barSize={30}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

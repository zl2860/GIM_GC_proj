// src/components/pages/IncrementalR2Page.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { BarChart3, Search, Filter } from 'lucide-react';
import { toSentenceCaseTitle } from '../../lib/utils';

// --- Data Interfaces ---
interface SimpleEntry {
  metabolic_trait: string;
  gim_r2: number;
  other_r2: number;
  total_r2: number;
  is_gim_trait: boolean;
  determinant_breakdown: Record<string, number>;
}

interface SimpleDataset {
  title: string;
  description: string;
  data: SimpleEntry[];
}

// Determinant keys in desired order
const determinants = [
  'GIM',
  'age',
  'sex',
  'drink_freq',
  'ethnicity_group',
  'ever_smoke',
  'BMI_avg',
  'center',
  'Diet (block)',
] as const;

// Friendly labels
const legendLabels: Record<string, string> = {
  center: 'Assessment center',
  'Diet (block)': 'Diet',
  GIM: 'Genetically predicted trait levels',
  ethnicity_group: 'Ethnicity',
  age: 'Age',
  sex: 'Sex',
  ever_smoke: 'Smoking',
  BMI_avg: 'BMI',
  drink_freq: 'Alcohol consumption',
};

// Color mapping in exact var order
const colorMap: Record<string, string> = {
  center: '#795F35',
  'Diet (block)': '#E33236',
  GIM: '#F6D980',
  ethnicity_group: '#E8A528',
  age: '#4384C8',
  sex: '#BB919E',
  ever_smoke: '#BDB58F',
  BMI_avg: '#EAA596',
  drink_freq: '#EE7D43',
};

// --- D3 Stacked Bar Chart Renderer ---
function createStackedBarChart(
  container: HTMLDivElement,
  data: Record<string, any>[],
  keys: readonly (typeof determinants)[number][]
) {
  // clear any old chart
  const sel = d3.select(container);
  sel.select('svg').remove();
  sel.select('.tooltip').remove();

  const margin = { top: 30, right: 20, bottom: 120, left: 60 };
  const width = container.clientWidth;
  const height = 500;

  // stack generator
  const stackGen = d3
    .stack<Record<string, any>, string>()
    .keys(keys as string[])
    .value((d, key) => d[key] || 0);
  const series = stackGen(data);

  // scales
  const x = d3
    .scaleBand<string>()
    .domain(data.map((d) => d.metabolic_trait))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) || 0;
  const y = d3
    .scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // create SVG
  const svg = sel
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('font-family', 'sans-serif');

  // y-axis + grid
  svg
    .append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5))
    .call((g) => g.select('.domain').remove())
    .call((g) =>
      g
        .selectAll('.tick line')
        .clone()
        .attr('x2', width - margin.left - margin.right)
        .attr('stroke-opacity', 0.1)
    );

  // x-axis (rotated)
  svg
    .append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em');

  // group for bars
  const plot = svg.append('g').attr('class', 'plot-area');

  // tooltip div (fixed)
  const tooltip = sel
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'fixed')
    .style('background', 'rgba(255,255,255,0.9)')
    .style('border', '1px solid #ccc')
    .style('padding', '8px')
    .style('border-radius', '4px')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  // draw bars and attach hover handlers
  series.forEach((layer) => {
    plot
      .append('g')
      .attr('class', `series series-${layer.key.replace(/[^\w]/g, '')}`)
      .attr('fill', colorMap[layer.key])
      .selectAll('rect')
      .data(layer)
      .join('rect')
      .attr('x', (d) => x(d.data.metabolic_trait)!)
      .attr('y', (d) => y(d[1]))
      .attr('height', (d) => y(d[0]) - y(d[1]))
      .attr('width', x.bandwidth())
      .on('mousemove', (event, d) => {
        const entry = d.data;
        const trait = entry.metabolic_trait as string;
        let totalVal = 0;
        let html = `<strong style="color:#111827">${trait}</strong><br/>`;
        keys.forEach((key) => {
          const v = entry[key] || 0;
          totalVal += v;
          html += `<div style="color:${colorMap[key]}">■ ${legendLabels[key]}: ${v.toFixed(
            4
          )}</div>`;
        });
        html += `<div style="border-top:1px solid #eee;margin-top:5px;padding-top:5px;font-weight:bold">
          Total R²: ${totalVal.toFixed(4)}
        </div>`;
        tooltip
          .html(html)
          .style('left', `${event.clientX + 10}px`)
          .style('top', `${event.clientY + 10}px`)
          .transition()
          .duration(50)
          .style('opacity', 1);
      })
      .on('mouseout', () =>
        tooltip.transition().duration(50).style('opacity', 0)
      );
  });
}

// --- React Component ---
const IncrementalR2Page: React.FC = () => {
  // state
  const [dataset, setDataset] = useState<SimpleDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showGIM, setShowGIM] = useState(false);
  const [topN, setTopN] = useState<number>(50);

  // D3 container ref
  const chartRef = useRef<HTMLDivElement>(null);

  // fetch data once
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/simple_incremental_r2.json`)
      .then((res) => res.json())
      .then((json: SimpleDataset) => setDataset(json))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // apply search / GIM / topN
  const filtered = useMemo(() => {
    if (!dataset) return [];
    let arr = dataset.data;
    if (searchTerm) {
      arr = arr.filter((d) =>
        d.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (showGIM) {
      arr = arr.filter((d) => d.is_gim_trait);
    }
    arr = [...arr].sort((a, b) => b.total_r2 - a.total_r2);
    return topN > 0 ? arr.slice(0, topN) : arr;
  }, [dataset, searchTerm, showGIM, topN]);

  // shape for D3
  const chartData = useMemo(
    () =>
      filtered.map((e) => {
        const o: any = { metabolic_trait: e.metabolic_trait };
        determinants.forEach((d) => {
          o[d] = e.determinant_breakdown[d] || 0;
        });
        return o;
      }),
    [filtered]
  );

  // derived stats
  const total = useMemo(() => filtered.length, [filtered]);
  
  // Calculate average Total R2 (New)
  const avgTotal = useMemo(
    () =>
      total
        ? filtered.reduce((s, d) => s + d.total_r2, 0) / total
        : 0,
    [filtered, total]
  );

  // Mean R² per determinant (for current filtered set)
  const meanR2ByDeterminant = useMemo(() => {
    if (!total || !filtered.length) return {} as Record<string, number>;
    const out: Record<string, number> = {};
    determinants.forEach((key) => {
      out[key] =
        filtered.reduce((s, d) => s + (d.determinant_breakdown[key] ?? 0), 0) /
        total;
    });
    return out;
  }, [filtered, total]);

  // render chart on data changes
  useEffect(() => {
    if (chartRef.current && chartData.length) {
      createStackedBarChart(chartRef.current, chartData, determinants);
    }
  }, [chartData]);

  // loading / error
  if (loading)
    return <div className="p-10 text-center">Loading...</div>;
  if (error || !dataset)
    return (
      <div className="p-10 text-red-600 text-center">
        {error || 'No data'}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {toSentenceCaseTitle(dataset.title)}
            </h1>
            <p className="text-gray-600">
              {dataset.description}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search traits…"
              className="pl-10 pr-4 py-2 border rounded w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <label className="flex items-center space-x-2">
            <Filter />
            <span>GIM only</span>
            <input
              type="checkbox"
              checked={showGIM}
              onChange={(e) => setShowGIM(e.target.checked)}
              className="form-checkbox h-5 w-5 text-indigo-600"
            />
          </label>

          <div>
            <label className="mr-2 font-medium">Top N:</label>
            <select
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="border rounded p-2"
            >
              {[10, 20, 50, 100, 0].map((v) => (
                <option key={v} value={v}>
                  {v || 'All'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary + Mean R² by determinant */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Total traits</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-2">{total}</p>
              <p className="text-sm text-gray-500 mt-1">Metabolomic traits in current view</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Mean total R²</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">{avgTotal.toFixed(3)}</p>
              <p className="text-sm text-gray-500 mt-1">Average total variance explained</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Mean R² by determinant</h3>
            <p className="text-sm text-gray-500 mb-4">Average incremental variance explained by each determinant (over the traits in current view).</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
              {determinants.map((key) => (
                <div
                  key={key}
                  className="flex flex-col items-start p-4 rounded-lg border border-gray-100 bg-gray-50/80 min-w-0"
                >
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <span
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: colorMap[key] }}
                    />
                    <span className="text-sm font-medium text-gray-700 break-words">
                      {legendLabels[key]}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 mt-2">
                    {total ? (meanR2ByDeterminant[key] ?? 0).toFixed(3) : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Panel */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-lg overflow-x-auto relative">
          {/* Sticky Legend */}
          <div className="sticky top-0 left-0 bg-white z-10 flex flex-wrap gap-4 py-2 px-4 border-b">
            {determinants.map((key) => (
              <div key={key} className="flex items-center space-x-1">
                <span
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: colorMap[key] }}
                />
                <span className="text-sm text-gray-700">
                  {legendLabels[key]}
                </span>
              </div>
            ))}
          </div>

          {/* D3 Chart Container */}
          <div
            ref={chartRef}
            style={{
              width: `${Math.max(chartData.length * 30, 600)}px`,
              height: '500px',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default IncrementalR2Page;

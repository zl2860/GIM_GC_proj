import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input'; // Assuming this is a shadcn/ui component

// Interface for each row of correlation data
interface CorrRow {
  NMR_trait: string;
  LCMS_trait: string;
  corr: number;
  p: number;
  NMR_trait_group: string;
  LC_MS_group: string;
}

// Type for the hover tooltip information
type HoverInfo = {
  label: string;
  corr: number;
  p: number;
  x: number;
  y: number;
};

/**
 * A React component to display correlations between NMR and LC-MS traits
 * as a two-level interactive heatmap.
 */
const CorrelationPairs: React.FC = () => {
  // State for raw data, loading status, search terms, and UI state
  const [raw, setRaw] = useState<CorrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<{ nmrGroup: string; lcmsGroup: string } | null>(null);
  const [traitSearch, setTraitSearch] = useState('');
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // --- Data Loading Effect ---
  // Fetches correlation data on component mount and filters for significance.
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/corr_pairs.json`)
      .then(r => r.json())
      .then((json: any[]) => {
        const rows = json
          .map(d => ({
            NMR_trait: d.NMR_trait,
            LCMS_trait: d.LCMS_trait,
            corr: d.corr,
            p: d.p,
            NMR_trait_group: d.NMR_trait_group,
            LC_MS_group: d.LC_MS_group,
          }))
          .filter(d => d.p < 0.05); // Keep only nominally significant correlations
        setRaw(rows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // --- Memoized Group-Level Computations ---
  // Filters groups based on search term
  const filteredGroups = useMemo(
    () =>
      raw.filter(
        d =>
          d.NMR_trait_group.toLowerCase().includes(search.toLowerCase()) ||
          d.LC_MS_group.toLowerCase().includes(search.toLowerCase())
      ),
    [raw, search]
  );

  // Get unique, sorted group names
  const nmrGroups = useMemo(
    () => Array.from(new Set(filteredGroups.map(d => d.NMR_trait_group))).sort(),
    [filteredGroups]
  );
  const lcmsGroups = useMemo(
    () => Array.from(new Set(filteredGroups.map(d => d.LC_MS_group))).sort(),
    [filteredGroups]
  );

  // Creates a matrix of average correlations for each group pair
  const groupMatrix = useMemo(() => {
    const m: Record<string, Record<string, number | undefined>> = {};
    nmrGroups.forEach(ng => {
      m[ng] = {};
      lcmsGroups.forEach(lg => {
        const subs = filteredGroups.filter(
          d => d.NMR_trait_group === ng && d.LC_MS_group === lg
        );
        // Calculate the average correlation if pairs exist
        m[ng][lg] = subs.length
          ? subs.reduce((sum, d) => sum + d.corr, 0) / subs.length
          : undefined;
      });
    });
    return m;
  }, [filteredGroups, nmrGroups, lcmsGroups]);

  // --- Memoized Trait-Level Computations (for drilled-down view) ---
  // Filters traits based on the selected group and trait search term
  const traitRows = useMemo(() => {
    if (!drill) return [];
    return raw.filter(
      d =>
        d.NMR_trait_group === drill.nmrGroup &&
        d.LC_MS_group === drill.lcmsGroup &&
        (d.NMR_trait.toLowerCase().includes(traitSearch.toLowerCase()) ||
          d.LCMS_trait.toLowerCase().includes(traitSearch.toLowerCase()))
    );
  }, [raw, drill, traitSearch]);

  // Get unique, sorted trait names for the drilled-down view
  const traitNMRs = useMemo(
    () => Array.from(new Set(traitRows.map(d => d.NMR_trait))).sort(),
    [traitRows]
  );
  const traitLCMS = useMemo(
    () => Array.from(new Set(traitRows.map(d => d.LCMS_trait))).sort(),
    [traitRows]
  );

  // Creates a matrix of specific correlations for each trait pair
  const traitMatrix = useMemo(() => {
    const m: Record<string, Record<string, CorrRow | undefined>> = {};
    traitNMRs.forEach(n => {
      m[n] = {};
      traitLCMS.forEach(l => (m[n][l] = undefined));
    });
    traitRows.forEach(d => {
      m[d.NMR_trait][d.LCMS_trait] = d;
    });
    return m;
  }, [traitRows, traitNMRs, traitLCMS]);

  // --- Render Logic: Early Exits ---
  if (loading) return <p className="p-6">Loading data...</p>;
  if (!raw.length)
    return (
      <p className="p-6 text-red-600">
        No nominally significant (P &lt; 0.05) correlations found in the data.
      </p>
    );

  // --- Render Logic: Group-Level View ---
  if (!drill) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Correlation Groups</h1>
            <div className="flex items-center gap-2">
                <Search className="text-gray-500" />
                <Input
                placeholder="Search group names…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-64"
                />
            </div>
        </div>

        {/* Heatmap Container with scrolling */}
        {nmrGroups.length && lcmsGroups.length ? (
          <div className="overflow-auto border border-gray-200 rounded-lg bg-white">
            <div
              className="inline-grid relative"
              style={{
                gridTemplateColumns: `180px repeat(${lcmsGroups.length}, 40px)`,
              }}
            >
              {/* Top-left corner cell */}
              <div className="sticky top-0 left-0 z-30 bg-white h-36 border-b border-r border-gray-200" />

              {/* LC-MS group headers (Top Axis) */}
              {lcmsGroups.map(lg => (
                <div key={lg} className="sticky top-0 z-20 bg-white h-36 w-10 border-b border-r border-gray-200">
                    <div className="w-full h-full relative flex justify-center items-end">
                         <div
                            className="absolute transform -rotate-[60deg] origin-bottom-right right-5 bottom-2 whitespace-nowrap cursor-pointer hover:font-bold"
                            onClick={() => setDrill({ nmrGroup: nmrGroups[0], lcmsGroup: lg })}
                         >
                            <span className="text-xs text-gray-700">{lg}</span>
                        </div>
                    </div>
                </div>
              ))}

              {/* NMR group rows (Left Axis + Data) */}
              {nmrGroups.map(ng => (
                <React.Fragment key={ng}>
                  <div
                    className="sticky left-0 z-10 bg-white h-10 flex items-center justify-end pr-4 text-sm font-medium text-gray-800 cursor-pointer hover:bg-gray-50 border-t border-r border-gray-200"
                    onClick={() => setDrill({ nmrGroup: ng, lcmsGroup: lcmsGroups[0] })}
                  >
                    {ng}
                  </div>
                  {lcmsGroups.map(lg => {
                    const c = groupMatrix[ng][lg];
                    const mag = c != null ? Math.abs(c) : 0;
                    // Red for positive, Blue for negative
                    const color = c > 0 ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)';

                    return (
                      <div
                        key={lg}
                        className="w-10 h-10 border-t border-r border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100"
                        style={{ background: '#f8f8f8' }}
                        onMouseEnter={e => {
                          if (c == null) return;
                          setHover({
                            label: `${ng} ↔ ${lg}`,
                            corr: c,
                            p: NaN, // p-value not applicable for group averages
                            x: e.pageX,
                            y: e.pageY,
                          });
                        }}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => {
                            if (c != null) {
                                setDrill({ nmrGroup: ng, lcmsGroup: lg })
                            }
                        }}
                      >
                        {c != null && (
                          <svg viewBox="0 0 20 20" className="w-full h-full" style={{ padding: '1px' }}>
                            <circle cx="10" cy="10" r={mag * 9} fill={color} />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Hover Tooltip */}
            {hover && (
              <div
                className="pointer-events-none fixed bg-black bg-opacity-75 text-white p-2 border border-gray-500 rounded shadow-lg text-sm z-50"
                style={{ top: hover.y + 15, left: hover.x + 15 }}
              >
                <strong className='block font-bold'>{hover.label}</strong>
                <div>mean r = {hover.corr.toFixed(3)}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="p-4">No groups match your search term.</p>
        )}
      </div>
    );
  }

  // --- Render Logic: Trait-Level Drill-Down View ---
  const { nmrGroup, lcmsGroup } = drill;
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          className="text-blue-600 hover:underline font-semibold"
          onClick={() => setDrill(null)}
        >
          ← Back to All Groups
        </button>
        <h2 className="text-xl font-semibold text-center">
          {nmrGroup} ↔ {lcmsGroup}
        </h2>
        <div className="flex items-center gap-2">
          <Search className="text-gray-500" />
          <Input
            placeholder="Filter trait names…"
            value={traitSearch}
            onChange={e => setTraitSearch(e.target.value)}
            className="w-64"
          />
        </div>
      </div>

      {/* Trait Heatmap Container */}
      {traitNMRs.length && traitLCMS.length ? (
        <div className="overflow-auto border border-gray-200 rounded-lg bg-white">
          <div
            className="inline-grid relative"
            style={{
              gridTemplateColumns: `200px repeat(${traitLCMS.length}, 32px)`,
            }}
          >
            {/* Top-left corner */}
            <div className="sticky top-0 left-0 z-30 bg-white h-36 border-b border-r border-gray-200" />

            {/* Trait LC-MS headers (Top Axis) */}
            {traitLCMS.map(l => (
                 <div key={l} className="sticky top-0 z-20 bg-white h-36 w-8 border-b border-r border-gray-200">
                    <div className="w-full h-full relative flex justify-center items-end">
                         <div className="absolute transform -rotate-[60deg] origin-bottom-right right-4 bottom-2 whitespace-nowrap">
                            <span className="text-xs text-gray-700">{l}</span>
                        </div>
                    </div>
                </div>
            ))}

            {/* Trait NMR rows (Left Axis + Data) */}
            {traitNMRs.map(n => (
              <React.Fragment key={n}>
                <div className="sticky left-0 z-10 bg-white h-8 flex items-center justify-end pr-4 text-sm font-medium text-gray-800 border-t border-r border-gray-200">
                  {n}
                </div>
                {traitLCMS.map(l => {
                  const cell = traitMatrix[n][l];
                  const corr = cell?.corr;
                  const mag = corr ? Math.abs(corr) : 0;
                  const color = corr && corr > 0 ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)';

                  return (
                    <div
                      key={l}
                      className="w-8 h-8 border-t border-r border-gray-200 flex items-center justify-center hover:bg-gray-100"
                      style={{ background: '#f8f8f8' }}
                      onMouseEnter={e => {
                        if (!cell) return;
                        setHover({
                          label: `${n} ↔ ${l}`,
                          corr: cell.corr,
                          p: cell.p,
                          x: e.pageX,
                          y: e.pageY,
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                    >
                      {cell && (
                        <svg viewBox="0 0 18 18" className="w-full h-full" style={{ padding: '1px' }}>
                          <circle cx="9" cy="9" r={mag * 8} fill={color} />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Hover Tooltip */}
          {hover && (
            <div
              className="pointer-events-none fixed bg-black bg-opacity-75 text-white p-2 border rounded shadow-lg text-sm z-50"
              style={{ top: hover.y + 15, left: hover.x + 15 }}
            >
              <strong className='block font-bold'>{hover.label}</strong>
              <div>r = {hover.corr.toFixed(3)}</div>
              <div>p = {hover.p.toExponential(2)}</div>
            </div>
          )}
        </div>
      ) : (
        <p className="p-4 text-gray-600">
          No trait pairs remain. Try broadening your filter.
        </p>
      )}
    </div>
  );
};

export default CorrelationPairs;

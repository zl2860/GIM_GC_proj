import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowLeft } from 'lucide-react';

// --- TYPE DEFINITIONS ---

// Interface for each row of correlation data from the JSON file
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
  value: string;
  x: number;
  y: number;
};

// --- HELPER & CHILD COMPONENTS ---

/**
 * A visually appealing loading spinner.
 */
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full p-8">
    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
  </div>
);

/**
 * A styled message component for errors or info.
 */
const InfoMessage: React.FC<{ children: React.ReactNode; type?: 'error' | 'info' }> = ({ children, type = 'info' }) => {
    const baseClasses = "p-6 text-center text-lg font-medium rounded-lg";
    const typeClasses = type === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600';
    return <div className={`${baseClasses} ${typeClasses}`}>{children}</div>;
}

/**
 * The main header for the component, containing title and search.
 */
const HeatmapHeader: React.FC<{ title: string; subtitle?: string; searchValue: string; onSearchChange: (value: string) => void; searchPlaceholder: string; }> =
({ title, subtitle, searchValue, onSearchChange, searchPlaceholder }) => (
    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="relative w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            />
        </div>
    </div>
);

/**
 * A single cell in the heatmap grid.
 */
const HeatmapCell: React.FC<{
    value: number | undefined;
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onClick: () => void;
}> = ({ value, onMouseEnter, onMouseLeave, onClick }) => {
    const mag = value != null ? Math.min(1, Math.abs(value)) : 0;
    // To make colors more brilliant, we set a minimum opacity and scale from there.
    const alpha = 0.45 + mag * 0.85;

    const bg =
      value == null
        ? '#F3F4F6' // A slightly darker gray for null values
        : value > 0
        ? `rgba(220, 38, 38, ${alpha})` // Vibrant Red for positive
        : `rgba(37, 99, 235, ${alpha})`; // Vibrant Blue for negative

    return (
        <div
            className="relative w-full h-full border-t border-r border-gray-200 cursor-pointer transition-transform duration-150 ease-in-out hover:scale-110 hover:z-10"
            style={{ backgroundColor: bg }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
        />
    );
};


/**
 * The main component to display correlations between NMR and LC-MS traits
 * as a two-level interactive heatmap.
 */
const CorrelationPairs: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [raw, setRaw] = useState<CorrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<{ nmrGroup: string; lcmsGroup: string } | null>(null);
  const [traitSearch, setTraitSearch] = useState('');
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // --- DATA FETCHING ---
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
          .filter(d => d.p < 0.05);
        setRaw(rows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // --- MEMOIZED COMPUTATIONS ---

  // Group-Level Data
  const filteredGroups = useMemo(() => raw.filter(d =>
      d.NMR_trait_group.toLowerCase().includes(search.toLowerCase()) ||
      d.LC_MS_group.toLowerCase().includes(search.toLowerCase())
    ), [raw, search]);

  const nmrGroups = useMemo(() => Array.from(new Set(filteredGroups.map(d => d.NMR_trait_group))).sort(), [filteredGroups]);
  const lcmsGroups = useMemo(() => Array.from(new Set(filteredGroups.map(d => d.LC_MS_group))).sort(), [filteredGroups]);

  const groupMatrix = useMemo(() => {
    const m: Record<string, Record<string, number | undefined>> = {};
    nmrGroups.forEach(ng => {
      m[ng] = {};
      lcmsGroups.forEach(lg => {
        const subs = filteredGroups.filter(d => d.NMR_trait_group === ng && d.LC_MS_group === lg);
        m[ng][lg] = subs.length ? subs.reduce((sum, d) => sum + d.corr, 0) / subs.length : undefined;
      });
    });
    return m;
  }, [filteredGroups, nmrGroups, lcmsGroups]);

  // Trait-Level Data (Drilled Down)
  const traitRows = useMemo(() => {
    if (!drill) return [];
    return raw.filter(d =>
        d.NMR_trait_group === drill.nmrGroup &&
        d.LC_MS_group === drill.lcmsGroup &&
        (d.NMR_trait.toLowerCase().includes(traitSearch.toLowerCase()) ||
          d.LCMS_trait.toLowerCase().includes(traitSearch.toLowerCase()))
    );
  }, [raw, drill, traitSearch]);

  const traitNMRs = useMemo(() => Array.from(new Set(traitRows.map(d => d.NMR_trait))).sort(), [traitRows]);
  const traitLCMS = useMemo(() => Array.from(new Set(traitRows.map(d => d.LCMS_trait))).sort(), [traitRows]);

  const traitMatrix = useMemo(() => {
    const m: Record<string, Record<string, CorrRow | undefined>> = {};
    traitNMRs.forEach(n => {
      m[n] = {};
      traitLCMS.forEach(l => (m[n][l] = undefined));
    });
    traitRows.forEach(d => { m[d.NMR_trait][d.LCMS_trait] = d; });
    return m;
  }, [traitRows, traitNMRs, traitLCMS]);

  // --- RENDER LOGIC ---

  if (loading) return <div className="h-96"><LoadingSpinner /></div>;
  if (!raw.length) return <InfoMessage type="error">No significant (P &lt; 0.05) correlations found.</InfoMessage>;

  // Tooltip Component
  const Tooltip = hover && (
    <div
      className="pointer-events-none fixed bg-gray-800 text-white p-3 rounded-lg shadow-2xl text-sm z-50 transition-opacity duration-150"
      style={{ top: hover.y + 20, left: hover.x + 20 }}
    >
      <strong className='block font-bold text-base'>{hover.label}</strong>
      <div className="mt-1">{hover.value}</div>
    </div>
  );

  // Main View: Group-Level Heatmap
  if (!drill) {
    return (
      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <HeatmapHeader
            title="Correlations between predicted NMR traits and LC-MS metabolites"
            subtitle="Correlation pairs meeting the nominal statistical significance threshold (P-values<0.05) are shown; click on any cell to drill into the full trait-level heatmap"
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search group names..."
        />
        {nmrGroups.length && lcmsGroups.length ? (
          <div className="overflow-auto p-4">
            <div
              className="inline-grid relative bg-gray-100"
              style={{ gridTemplateColumns: `200px repeat(${lcmsGroups.length}, 40px)` }}
            >
              {/* Top-left corner */}
              <div className="sticky top-0 left-0 z-30 bg-white h-64 border-b border-r border-gray-200" />

              {/* LC-MS group headers (Top) */}
              {lcmsGroups.map(lg => (
                <div key={lg} className="sticky top-0 z-20 bg-white h-64 w-10 border-b border-r border-gray-200">
                    <div className="relative w-full h-full">
                        <div
                            className="absolute bottom-2 left-6 transform -rotate-90 origin-bottom-left whitespace-nowrap cursor-pointer hover:font-bold text-gray-600 text-xs"
                            onClick={() => setDrill({ nmrGroup: nmrGroups[0], lcmsGroup: lg })}
                        >
                            {lg}
                        </div>
                    </div>
                </div>
              ))}

              {/* NMR group rows (Left) & Data Cells */}
              {nmrGroups.map(ng => (
                <React.Fragment key={ng}>
                  <div className="sticky left-0 z-10 bg-white h-10 flex items-center justify-end pr-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 border-t border-r border-gray-200"
                       onClick={() => setDrill({ nmrGroup: ng, lcmsGroup: lcmsGroups[0] })}>
                    {ng}
                  </div>
                  {lcmsGroups.map(lg => {
                    const c = groupMatrix[ng][lg];
                    return (
                      <HeatmapCell
                        key={lg}
                        value={c}
                        onMouseEnter={e => c != null && setHover({
                            label: `${ng} ↔ ${lg}`,
                            value: `mean r = ${c.toFixed(3)}`,
                            x: e.pageX, y: e.pageY
                        })}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => c != null && setDrill({ nmrGroup: ng, lcmsGroup: lg })}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            {Tooltip}
          </div>
        ) : (
          <InfoMessage>No groups match your search.</InfoMessage>
        )}
      </div>
    );
  }

  // Drill-Down View: Trait-Level Heatmap
  const { nmrGroup, lcmsGroup } = drill;
  return (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
             <button
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                onClick={() => setDrill(null)}
            >
                <ArrowLeft size={20} />
                Back to Groups
            </button>
            <div className="text-center">
                 <h2 className="text-xl font-bold text-gray-800">{nmrGroup}</h2>
                 <p className="text-sm text-gray-500">vs. {lcmsGroup}</p>
            </div>
            <div className="relative w-1/3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Filter trait names…"
                    value={traitSearch}
                    onChange={e => setTraitSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full bg-white focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>

      {traitNMRs.length && traitLCMS.length ? (
        <div className="overflow-auto p-4">
          <div
            className="inline-grid relative bg-gray-100"
            style={{ gridTemplateColumns: `220px repeat(${traitLCMS.length}, 32px)` }}
          >
            {/* Top-left corner */}
            <div className="sticky top-0 left-0 z-30 bg-white h-64 border-b border-r border-gray-200" />

            {/* Trait LC-MS headers (Top) */}
            {traitLCMS.map(l => (
                 <div key={l} className="sticky top-0 z-20 bg-white h-64 w-8 border-b border-r border-gray-200">
                     <div className="relative w-full h-full">
                        <div className="absolute bottom-2 left-5 transform -rotate-90 origin-bottom-left whitespace-nowrap text-gray-600 text-xs">{l}</div>
                     </div>
                </div>
            ))}

            {/* Trait NMR rows (Left) & Data Cells */}
            {traitNMRs.map(n => (
              <React.Fragment key={n}>
                <div className="sticky left-0 z-10 bg-white h-8 flex items-center justify-end pr-4 text-sm font-medium text-gray-700 border-t border-r border-gray-200">{n}</div>
                {traitLCMS.map(l => {
                  const cell = traitMatrix[n][l];
                  return (
                    <HeatmapCell
                      key={l}
                      value={cell?.corr}
                      onMouseEnter={e => cell && setHover({
                        label: `${n} ↔ ${l}`,
                        value: `r = ${cell.corr.toFixed(3)}, p = ${cell.p.toExponential(2)}`,
                        x: e.pageX, y: e.pageY
                      })}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => {}} // No action on click in drill-down
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          {Tooltip}
        </div>
      ) : (
        <InfoMessage>No trait pairs match your filter.</InfoMessage>
      )}
    </div>
  );
};

export default CorrelationPairs;

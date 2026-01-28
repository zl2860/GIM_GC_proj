import React, { useState, useEffect, useMemo } from 'react';
import { Search, Info, ArrowLeft, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import D3Heatmap, { Cell } from '../D3Heatmap';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Slider } from '../ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface CorrelationRecord {
  nmr_trait: string;
  lcms_trait: string;
  correlation: number;
  lcms_group: string;
  platform: string;
  p_value: number;
  nmr_group: string;
  p_value_adjusted: number | null;
  is_extremely_significant?: boolean | null;
  passes_bonferroni?: boolean | null;
  or_label_gc?: string | null;
  or_p_gc?: number | null;
  or_label_hgin?: string | null;
  or_p_hgin?: number | null;
  lcms_associated_gc?: boolean | null;
  lcms_associated_hgin?: boolean | null;
  pair_index?: number | null;
}

interface CorrelationSummary {
  total_pairs: number;
  unique_nmr_traits: number;
  unique_lcms_traits: number;
  unique_nmr_groups: number;
  unique_lcms_groups: number;
  extremely_significant_pairs: number;
  bonferroni_significant_pairs: number;
  gc_associated_lcms_traits: number;
  hgin_associated_lcms_traits: number;
}

interface CorrelationResponse {
  title: string;
  description: string;
  summary: CorrelationSummary;
  data: CorrelationRecord[];
}

type FilterKey =
  | 'extremeOnly'
  | 'bonferroniOnly'
  | 'gcAssociated'
  | 'hginAssociated';

type DirectionFilter = 'all' | 'positive' | 'negative';

interface FiltersState {
  extremeOnly: boolean;
  bonferroniOnly: boolean;
  gcAssociated: boolean;
  hginAssociated: boolean;
}

type TooltipInfo = {
  content: React.ReactNode;
  x: number;
  y: number;
};

const FILTER_DEFINITIONS: { key: FilterKey; label: string; helper: string }[] = [
  {
    key: 'extremeOnly',
    label: 'P-value < 0.001',
    helper: 'Keep pairs with nominal p-value below 0.001'
  },
  {
    key: 'bonferroniOnly',
    label: 'Bonferroni correction',
    helper: 'Keep pairs passing Bonferroni-adjusted P-value < 0.05'
  },
  {
    key: 'gcAssociated',
    label: 'LC-MS linked to GC',
    helper: 'LC-MS detected metabolites associated with GC (P-value < 0.05)'
  },
  {
    key: 'hginAssociated',
    label: 'LC-MS linked to GC/HGIN',
    helper: 'LC-MS detected metabolites associated with GC or HGIN (P-value < 0.05)'
  }
];

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full p-8">
    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
  </div>
);

const InfoMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 text-center text-lg font-medium rounded-lg bg-gray-50 text-gray-600">
    {children}
  </div>
);

const initialFilters: FiltersState = {
  extremeOnly: false,
  bonferroniOnly: false,
  gcAssociated: false,
  hginAssociated: false
};

const CorrelationPairs: React.FC = () => {
  const [resp, setResp] = useState<CorrelationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupQuery, setGroupQuery] = useState('');
  const [traitSearch, setTraitSearch] = useState('');
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [minAbsCorrelation, setMinAbsCorrelation] = useState<number>(0);
  const [drill, setDrill] = useState<{ nmrGroup: string; lcmsGroup: string } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}data/corr_pairs_2026.json`)
      .then(r => {
        if (!r.ok) {
          throw new Error(`Request failed with status ${r.status}`);
        }
        return r.json();
      })
      .then((json: CorrelationResponse) => setResp(json))
      .catch(error => {
        console.error(error);
        toast.error('Failed to load correlation data');
      })
      .finally(() => setLoading(false));
  }, []);

  const platforms = useMemo(() => {
    if (!resp?.data) return [];
    return Array.from(new Set(resp.data.map(d => d.platform).filter(Boolean))).sort();
  }, [resp]);

  const maxAbsCorrelation = useMemo(() => {
    if (!resp?.data || resp.data.length === 0) return 1;
    return Math.max(...resp.data.map(d => Math.abs(d.correlation)));
  }, [resp]);

  const toggleFilter = (key: FilterKey) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setDirection('all');
    setPlatform('all');
    setMinAbsCorrelation(0);
  };

  const summaryCards = useMemo(() => {
    if (!resp?.summary) return [];
    const s = resp.summary;
    return [
      {
        label: 'Total presented correlation pairs',
        value: s.total_pairs,
        helper: 'Correlation pairs that passed the initial screening (P-value<0.05)'
      },
      {
        label: 'Total unique NMR traits',
        value: s.unique_nmr_traits,
        helper: 'Predicted NMR traits represented in the map'
      },
      {
        label: 'Total presented LC-MS detected metabolites',
        value: s.unique_lcms_traits,
        helper: 'Directly measured LC-MS metabolites represented'
      },
      {
        label: 'Significant correlation pairs',
        value: s.extremely_significant_pairs,
        helper: 'Pairs with nominal P < 0.001'
      },
      {
        label: 'Correlation pairs with adjustment',
        value: s.bonferroni_significant_pairs,
        helper: 'Pairs with adjusted P-value<0.05'
      },
      {
        label: 'LC-MS detected metabolites linked to GC/HGIN',
        value: s.hgin_associated_lcms_traits,
        helper: 'correlation pairs related to the metabolites involved association with GC/HGIN risk'
      }
    ];
  }, [resp]);

  const filteredRecords = useMemo(() => {
    if (!resp?.data) return [];
    return resp.data.filter(row => {
      if (filters.extremeOnly && !row.is_extremely_significant) return false;
      if (filters.bonferroniOnly && !row.passes_bonferroni) return false;
      if (filters.gcAssociated && !row.lcms_associated_gc) return false;
      if (filters.hginAssociated && !row.lcms_associated_hgin) return false;
      if (direction === 'positive' && row.correlation <= 0) return false;
      if (direction === 'negative' && row.correlation >= 0) return false;
      if (platform !== 'all' && row.platform !== platform) return false;
      if (Math.abs(row.correlation) < minAbsCorrelation) return false;
      return true;
    });
  }, [resp, filters, direction, platform, minAbsCorrelation]);

  const groupMatches = useMemo(() => {
    const query = groupQuery.trim().toLowerCase();
    if (!query) return filteredRecords;
    return filteredRecords.filter(
      row =>
        row.nmr_group.toLowerCase().includes(query) ||
        row.lcms_group.toLowerCase().includes(query)
    );
  }, [filteredRecords, groupQuery]);

  const directionOptions: { value: DirectionFilter; label: string }[] = [
    { value: 'all', label: 'All correlations' },
    { value: 'positive', label: 'Positive only' },
    { value: 'negative', label: 'Negative only' }
  ];

  const {
    cells: groupData,
    stats: groupStats
  } = useMemo(() => {
    const aggregate = new Map<
      string,
      {
        sum: number;
        count: number;
        extreme: number;
        bonferroni: number;
        gc: number;
        hgin: number;
      }
    >();

    groupMatches.forEach(row => {
      const key = `${row.nmr_group}|${row.lcms_group}`;
      if (!aggregate.has(key)) {
        aggregate.set(key, {
          sum: 0,
          count: 0,
          extreme: 0,
          bonferroni: 0,
          gc: 0,
          hgin: 0
        });
      }
      const entry = aggregate.get(key)!;
      entry.sum += row.correlation;
      entry.count += 1;
      if (row.is_extremely_significant) entry.extreme += 1;
      if (row.passes_bonferroni) entry.bonferroni += 1;
      if (row.lcms_associated_gc) entry.gc += 1;
      if (row.lcms_associated_hgin) entry.hgin += 1;
    });

    const cells: Cell[] = [];
    aggregate.forEach((value, key) => {
        const [rowId, colId] = key.split('|');
      cells.push({
        rowId,
        colId,
        value: value.sum / value.count,
        N: value.count
      });
    });

    return { cells, stats: aggregate };
  }, [groupMatches]);

  const nmrGroups = useMemo(
    () => Array.from(new Set(groupMatches.map(row => row.nmr_group))).sort(),
    [groupMatches]
  );
  const lcmsGroups = useMemo(
    () => Array.from(new Set(groupMatches.map(row => row.lcms_group))).sort(),
    [groupMatches]
  );

  const traitRows = useMemo(() => {
    if (!drill) return [];
    const query = traitSearch.trim().toLowerCase();
    return filteredRecords.filter(row => {
      const matchesGroup =
        row.nmr_group === drill.nmrGroup && row.lcms_group === drill.lcmsGroup;
      if (!matchesGroup) return false;
      if (!query) return true;
      return (
        row.nmr_trait.toLowerCase().includes(query) ||
        row.lcms_trait.toLowerCase().includes(query)
      );
    });
  }, [filteredRecords, drill, traitSearch]);

  const traitNMRs = useMemo(
    () => Array.from(new Set(traitRows.map(row => row.nmr_trait))).sort(),
    [traitRows]
  );
  const traitLCMS = useMemo(
    () => Array.from(new Set(traitRows.map(row => row.lcms_trait))).sort(),
    [traitRows]
  );

  const traitMap = useMemo(() => {
    const map = new Map<string, CorrelationRecord>();
    traitRows.forEach(row => {
      map.set(`${row.nmr_trait}|${row.lcms_trait}`, row);
    });
    return map;
  }, [traitRows]);

  const traitData: Cell[] = useMemo(
    () =>
      traitRows.map(row => ({
        rowId: row.nmr_trait,
        colId: row.lcms_trait,
        value: row.correlation,
        pValue: row.p_value
      })),
    [traitRows]
  );

  const handleMouseOver = (event: React.MouseEvent, cell: Cell) => {
    if (!drill) {
      const key = `${cell.rowId}|${cell.colId}`;
      const stats = groupStats.get(key);
    const content = (
        <div className="space-y-1">
          <div className="font-semibold text-sm">
            {cell.rowId} vs. {cell.colId}
          </div>
          <div>Average correlation: {cell.value.toFixed(3)}</div>
          {stats && (
            <>
              <div>Pairs after filters: {stats.count}</div>
              <div>P &lt; 0.001: {stats.extreme}</div>
              <div>Bonferroni significant: {stats.bonferroni}</div>
              <div>GC-linked traits: {stats.gc}</div>
              <div>GC/HGIN-linked traits: {stats.hgin}</div>
            </>
          )}
        </div>
      );
      setTooltip({ content, x: event.pageX, y: event.pageY });
      return;
    }

    const record = traitMap.get(`${cell.rowId}|${cell.colId}`);
    const content = record ? (
      <div className="space-y-1">
        <div className="font-semibold text-sm">
          {record.nmr_trait} vs. {record.lcms_trait}
        </div>
        <div>Correlation (r): {record.correlation.toFixed(3)}</div>
        {record.p_value != null && (
          <div>p-value: {record.p_value.toExponential(2)}</div>
        )}
        {record.p_value_adjusted != null && (
          <div>Adjusted p-value: {record.p_value_adjusted.toExponential(2)}</div>
        )}
        {record.or_label_gc && (
          <div>
            GC OR: {record.or_label_gc}
            {record.or_p_gc != null && (
              <span> (P = {record.or_p_gc.toExponential(2)})</span>
            )}
          </div>
        )}
        {record.or_label_hgin && (
      <div>
            GC/HGIN OR: {record.or_label_hgin}
            {record.or_p_hgin != null && (
              <span> (P = {record.or_p_hgin.toExponential(2)})</span>
            )}
          </div>
        )}
        {record.lcms_associated_gc && (
          <div className="text-emerald-500">LC-MS trait associated with GC</div>
        )}
        {record.lcms_associated_hgin && (
          <div className="text-sky-500">LC-MS trait associated with GC/HGIN</div>
        )}
        {record.passes_bonferroni && (
          <div className="text-rose-500">Bonferroni significant</div>
        )}
      </div>
    ) : (
      <div>No record details available.</div>
    );

    setTooltip({ content, x: event.pageX, y: event.pageY });
  };
  
  const handleMouseOut = () => setTooltip(null);

  const tooltipComponent = tooltip && (
      <div
        className="fixed z-50 p-3 text-xs text-white bg-gray-900 rounded-md shadow-lg pointer-events-none"
        style={{ top: tooltip.y + 15, left: tooltip.x + 15 }}
      >
        {tooltip.content}
      </div>
  );

  if (loading) {
    return <div className="h-96 rounded-xl bg-white shadow"><LoadingSpinner /></div>;
  }

  if (!resp || resp.data.length === 0) {
    return <InfoMessage>No correlation data available.</InfoMessage>;
  }

  if (!groupData.length && !drill) {
    return (
      <div className="space-y-4">
        <HeaderSection
          resp={resp}
          summaryCards={summaryCards}
        />
        <InfoMessage>No groups match the current filter settings.</InfoMessage>
      </div>
    );
  }

  if (!drill) {
    return (
      <div className="space-y-6">
        <HeaderSection
          resp={resp}
          summaryCards={summaryCards}
        />

      <Card className="shadow-lg border border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold text-gray-800">Group-level heatmap</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Average correlations by NMR and LC-MS groups. Click a cell to explore individual trait pairs.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex gap-6 items-start justify-center">
            {/* Heatmap */}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <div className="mb-4 w-full max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    value={groupQuery}
                    onChange={event => setGroupQuery(event.target.value)}
                    placeholder="Search group names…"
                    className="pl-10"
                  />
                </div>
              </div>
              <div
                className="overflow-auto relative w-full flex justify-center"
                onMouseLeave={handleMouseOut}
              >
                {tooltipComponent}
                {nmrGroups.length > 0 && lcmsGroups.length > 0 ? (
                  <TooltipProvider delayDuration={150}>
                     <D3Heatmap
                        rows={nmrGroups.map(id => ({ id, label: id }))}
                        columns={lcmsGroups.map(id => ({ id, label: id }))}
                        data={groupData}
                        onCellClick={(row, col) => setDrill({ nmrGroup: row.id, lcmsGroup: col.id })}
                        onCellMouseOver={handleMouseOver}
                        onCellMouseOut={handleMouseOut}
                    />
                  </TooltipProvider>
                ) : (
                  <InfoMessage>No groups match the current search.</InfoMessage>
                )}
              </div>
            </div>
            
            {/* Filters panel on the right */}
            <div className="w-80 flex-shrink-0">
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-slate-600" />
                  <CardTitle className="text-sm font-semibold text-slate-700">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">
                        Correlation direction
                      </label>
                      <Select value={direction} onValueChange={value => setDirection(value as DirectionFilter)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {directionOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">Platform</label>
                      <Select value={platform} onValueChange={value => setPlatform(value)}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="All platforms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All platforms</SelectItem>
                          {platforms.map(item => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-slate-500">
                          Minimum absolute correlation
                        </label>
                        <span className="text-xs text-gray-600 font-medium">
                          |r| ≥ {minAbsCorrelation.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={maxAbsCorrelation}
                        step={0.01}
                        value={[minAbsCorrelation]}
                        onValueChange={([value]) => setMinAbsCorrelation(value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2">Significance filters</label>
                      <div className="space-y-2">
                        {FILTER_DEFINITIONS.map(definition => (
                          <label
                            key={definition.key}
                            className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer"
                            title={definition.helper}
                          >
                            <input
                              type="checkbox"
                              checked={filters[definition.key]}
                              onChange={() => toggleFilter(definition.key)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span>
                              <span className="font-medium block">{definition.label}</span>
                              <span className="text-xs text-gray-500">{definition.helper}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <button
                      onClick={resetFilters}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                    >
                      Reset filters
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }

  const { nmrGroup, lcmsGroup } = drill;

  return (
    <div className="space-y-6">
      <HeaderSection
        resp={resp}
        summaryCards={summaryCards}
      />

    <Card className="shadow-lg border border-gray-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-800">{nmrGroup}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">vs. {lcmsGroup}</p>
          </div>
          <button
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-colors"
            onClick={() => setDrill(null)}
          >
            <ArrowLeft size={18} /> Back to group heatmap
          </button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex gap-6 items-start justify-center">
          {/* Heatmap */}
          <div className="flex-1 min-w-0 flex flex-col items-center">
            <div className="mb-4 w-full max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  value={traitSearch}
                  onChange={event => setTraitSearch(event.target.value)}
                  placeholder="Filter trait names…"
                  className="pl-10"
                />
              </div>
            </div>
            <div
              className="overflow-auto relative w-full flex justify-center"
              onMouseLeave={handleMouseOut}
            >
              {tooltipComponent}
              {traitNMRs.length > 0 && traitLCMS.length > 0 ? (
                <TooltipProvider delayDuration={150}>
                   <D3Heatmap
                      rows={traitNMRs.map(id => ({ id, label: id }))}
                      columns={traitLCMS.map(id => ({ id, label: id }))}
                      data={traitData}
                      onCellMouseOver={handleMouseOver}
                      onCellMouseOut={handleMouseOut}
                  />
                </TooltipProvider>
              ) : (
                <InfoMessage>No trait pairs match the current filters.</InfoMessage>
              )}
            </div>
          </div>
          
          {/* Filters panel on the right */}
          <div className="w-80 flex-shrink-0">
            <Card className="shadow-sm border">
              <CardHeader className="pb-2 flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <CardTitle className="text-sm font-semibold text-slate-700">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">
                      Correlation direction
                    </label>
                    <Select value={direction} onValueChange={value => setDirection(value as DirectionFilter)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {directionOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">Platform</label>
                    <Select value={platform} onValueChange={value => setPlatform(value)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="All platforms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All platforms</SelectItem>
                        {platforms.map(item => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-500">
                        Minimum absolute correlation
                      </label>
                      <span className="text-xs text-gray-600 font-medium">
                        |r| ≥ {minAbsCorrelation.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={maxAbsCorrelation}
                      step={0.01}
                      value={[minAbsCorrelation]}
                      onValueChange={([value]) => setMinAbsCorrelation(value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2">Significance filters</label>
                    <div className="space-y-2">
                      {FILTER_DEFINITIONS.map(definition => (
                        <label
                          key={definition.key}
                          className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer"
                          title={definition.helper}
                        >
                          <input
                            type="checkbox"
                            checked={filters[definition.key]}
                            onChange={() => toggleFilter(definition.key)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span>
                            <span className="font-medium block">{definition.label}</span>
                            <span className="text-xs text-gray-500">{definition.helper}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <button
                    onClick={resetFilters}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                  >
                    Reset filters
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

interface HeaderSectionProps {
  resp: CorrelationResponse;
  summaryCards: { label: string; value: number; helper: string }[];
}

const HeaderSection: React.FC<HeaderSectionProps> = ({
  resp,
  summaryCards
}) => {
  return (
    <div className="bg-white shadow rounded-xl border border-gray-200 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{resp.title}</h1>
          <p className="text-gray-600 mt-1">{resp.description}</p>
        </div>
      </div>

      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {summaryCards.map(card => (
            <div
              key={card.label}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {card.value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2">{card.helper}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 mt-1 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">
            About the map
          </h2>
          <p className="text-sm leading-6 mt-1">
            Start with the group-level heatmap to identify clusters of strong correlations.
            Use the filters to focus on stringent significance criteria or specific platforms.
            Clicking a cell reveals individual trait pairs with detailed statistics, including
            odds ratios for GC and GC/HGIN associations.
          </p>
        </div>
        </div>
    </div>
  );
};

export default CorrelationPairs;
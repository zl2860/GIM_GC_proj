import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Info, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { toSentenceCaseTitle } from '../../lib/utils';

const PALETTE = ['#d4de9c', '#94c58f', '#86c7b4', '#9cd2ed', '#a992c0'];

type CohortKey =
  | 'ukbb_measured'
  | 'ukbb_predicted'
  | 'sit_predicted'
  | 'mits_predicted'
  | 'ugced_predicted';

type MetricKey = 'log_rr' | 'rr';

interface RiskData {
  trait: string;
  ukbb_measured_log_rr: number | null;
  ukbb_measured_rr: number | null;
  ukbb_predicted_log_rr: number | null;
  ukbb_predicted_rr: number | null;
  sit_predicted_log_rr: number | null;
  sit_predicted_rr: number | null;
  mits_predicted_log_rr: number | null;
  mits_predicted_rr: number | null;
  ugced_predicted_log_rr: number | null;
  ugced_predicted_rr: number | null;
  consistent_rr_count_measured_and_predicted: number | null;
  consistent_rr_count_predicted_only: number | null;
  significant_measured: boolean | null;
  significant_predicted: boolean | null;
  association_directions: string | null;
  same_direction_measured_predicted: boolean | null;
  highlight_ukbb_consistent: boolean | null;
  highlight_multicohort_consistent: boolean | null;
}

interface RiskSummary {
  trait_count: number;
  significant_measured_count: number;
  significant_predicted_count: number;
  consistent_direction_count: number;
  highlighted_in_ukbb_count: number;
  highlighted_multicohort_count: number;
}

interface RiskComparisonResponse {
  title: string;
  description: string;
  notes: string;
  summary: RiskSummary;
  data: RiskData[];
}

const COHORTS: { key: CohortKey; label: string; color: string; description: string }[] = [
  {
    key: 'ukbb_measured',
    label: 'UKBB discovery – measured',
    color: PALETTE[0],
    description: 'Directly measured metabolomic traits in the UKBB discovery cohort'
  },
  {
    key: 'ukbb_predicted',
    label: 'UKBB discovery – predicted',
    color: PALETTE[1],
    description: 'Genetically predicted trait levels in the UKBB discovery cohort'
  },
  {
    key: 'sit_predicted',
    label: 'SIT – predicted',
    color: PALETTE[2],
    description: 'Genetically predicted trait levels in the SIT cohort'
  },
  {
    key: 'mits_predicted',
    label: 'MITS – predicted',
    color: PALETTE[3],
    description: 'Genetically predicted trait levels in the MITS cohort'
  },
  {
    key: 'ugced_predicted',
    label: 'UGCED – predicted',
    color: PALETTE[4],
    description: 'Genetically predicted trait levels in the UGCED cohort'
  }
];

const METRIC_OPTIONS: { key: MetricKey; label: string; helper: string }[] = [
  {
    key: 'log_rr',
    label: 'Log(RR)',
    helper: 'Natural logarithm of the relative risk; 0 indicates no effect'
  },
  {
    key: 'rr',
    label: 'Relative risk',
    helper: 'Exponentiated relative risk; 1 indicates no effect'
  }
];

const METRIC_DECIMALS: Record<MetricKey, number> = {
  log_rr: 3,
  rr: 3
};

const VALUE_FIELDS: Record<CohortKey, Record<MetricKey, keyof RiskData>> = {
  ukbb_measured: {
    log_rr: 'ukbb_measured_log_rr',
    rr: 'ukbb_measured_rr'
  },
  ukbb_predicted: {
    log_rr: 'ukbb_predicted_log_rr',
    rr: 'ukbb_predicted_rr'
  },
  sit_predicted: {
    log_rr: 'sit_predicted_log_rr',
    rr: 'sit_predicted_rr'
  },
  mits_predicted: {
    log_rr: 'mits_predicted_log_rr',
    rr: 'mits_predicted_rr'
  },
  ugced_predicted: {
    log_rr: 'ugced_predicted_log_rr',
    rr: 'ugced_predicted_rr'
  }
};

type CohortSortKey = `cohort:${CohortKey}`;

type SortKey =
  | 'trait'
  | CohortSortKey
  | 'sigMeasured'
  | 'sigPredicted'
  | 'sameDirection'
  | 'consistentCombined'
  | 'consistentGenetic'
  | 'highlight';

const getCohortSortKey = (cohort: CohortKey): CohortSortKey =>
  `cohort:${cohort}` as const;

type Filters = {
  measuredSignificant: boolean;
  predictedSignificant: boolean;
  consistentDirection: boolean;
  highlightUkbbOnly: boolean;
  highlightMultiOnly: boolean;
};

const FILTER_DEFINITIONS: { key: keyof Filters; label: string; helper?: string }[] = [
  {
    key: 'measuredSignificant',
    label: 'Significantly associated with GC (measured levels, UKBB)',
    helper: 'Keep only traits with FDR q < 0.05 for directly measured levels in UKBB'
  },
  {
    key: 'predictedSignificant',
    label: 'Significantly associated with GC (genetically predicted, UKBB)',
    helper: 'Keep only traits with P < 0.05 for genetically predicted levels in UKBB'
  },
  {
    key: 'consistentDirection',
    label: 'Measured and predicted in same direction (UKBB)',
    helper: 'Keep only traits where measured and predicted effects point the same way in the UKBB Discovery cohort'
  },
  {
    key: 'highlightUkbbOnly',
    label: 'Significant in both measured and predicted (UKBB)',
    helper: 'Keep only traits that are significant in both levels in UKBB with same direction'
  },
  {
    key: 'highlightMultiOnly',
    label: 'Consistent direction in ≥3 cohorts',
    helper: 'Keep only traits whose genetically predicted effect direction is consistent across ≥3 cohorts'
  }
];

type ColumnFilterState = {
  measured: 'all' | 'significant' | 'non-significant' | 'na';
  predicted: 'all' | 'significant' | 'non-significant' | 'na';
  direction: 'all' | 'positive' | 'negative' | 'mixed' | 'none';
  highlight: 'all' | 'any' | 'ukbb' | 'multi' | 'none';
};

const COLUMN_DESCRIPTIONS = {
  trait: 'Standardized metabolomic trait name.',
  cohortMetric:
    'Selected metric (log RR or RR) for each cohort, summarizing effect size on GC risk.',
  sigMeasured: 'Significance of measured levels vs GC incidence (FDR q-value< 0.05) in the UKBB Discovery cohort.',
  sigPredicted:
    'Significance of genetically predicted levels vs GC incidence (P-value<0.05) in the UKBB Discovery cohort.',
  sameDirection: 'Indicates whether measured and genetically predicted effects align in direction in the UKBB Discovery cohort.',
  consistentCombined:
    'Number of cohorts where measured and predicted metrics share the same direction (includes UKBB).',
  consistentGenetic:
    'Number of cohorts where genetically predicted metrics share the same direction.',
  highlight:
    'Author highlights: UKBB = consistent & significant in UKBB; Multi = consistent direction across ≥3 cohorts.',
  directions:
    'Effect directions for UKBB | SIT | MITS | UGCED (\"+\" = RR>1, \"-\" = RR<1) using genetically predicted levels.'
};

const DATA_URL = `${import.meta.env.BASE_URL}data/risk_associations_2026.json`;

const formatTrait = (trait?: string) =>
  trait ? trait.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : 'Unknown trait';

const formatMetricValue = (value: number | null | undefined, metric: MetricKey) => {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(METRIC_DECIMALS[metric]);
};

const formatCount = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toString();
};

const parseDirections = (directions: string | null | undefined) => {
  if (!directions) return [] as string[];
  return directions
    .split('|')
    .map(token => token.trim())
    .filter(Boolean);
};

export default function RiskAssociationsPage() {
  const [resp, setResp] = useState<RiskComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohorts, setSelectedCohorts] = useState<CohortKey[]>(
    COHORTS.map(c => c.key)
  );
  // Fixed to log_rr only
  const metric: MetricKey = 'log_rr';
  const [sortState, setSortState] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>(
    { key: 'trait', direction: 'asc' }
  );
  const [filters, setFilters] = useState<Filters>({
    measuredSignificant: false,
    predictedSignificant: false,
    consistentDirection: false,
    highlightUkbbOnly: false,
    highlightMultiOnly: false
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({
    measured: 'all',
    predicted: 'all',
    direction: 'all',
    highlight: 'all'
  });
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollInnerRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(DATA_URL)
      .then(r => {
        if (!r.ok) throw new Error(`Request failed with status ${r.status}`);
        return r.json();
      })
      .then(setResp)
      .catch(error => {
        console.error(error);
        toast.error('Failed to load risk association data');
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleCohort = (key: CohortKey) => {
    setSelectedCohorts(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const requestSort = (key: SortKey) => {
    setSortState(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const toggleFilter = (key: keyof Filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateColumnFilter = <K extends keyof ColumnFilterState>(
    key: K,
    value: ColumnFilterState[K]
  ) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const notesParagraphs = useMemo(() => {
    if (!resp) return [];
    const traitCount = resp.summary?.trait_count ?? 0;
    const measuredSig = resp.summary?.significant_measured_count ?? 0;
    const predictedSig = resp.summary?.significant_predicted_count ?? 0;
    const multiHighlight = resp.summary?.highlighted_multicohort_count ?? 0;

    return [
      `Relative-risk (RR) estimates are shown for ${traitCount.toLocaleString()} metabolomic traits. Directly measured levels are from the UKBB Discovery cohort (¹H-NMR metabolomics); genetically predicted levels are from CSL models and were evaluated in the SIT, MITS, and UGCED cohorts.`,
      `Each cohort column reports log-relative risk (log-RR) or RR from cohort-specific regression models. Association directions indicate whether genetically predicted levels are positively (+) or inversely (–) associated with GC risk. Highlighted traits are those significant in both measured and predicted levels in UKBB and/or with consistent direction in ≥3 cohorts (${multiHighlight.toLocaleString()} traits).`,
      `Use the filters to restrict to traits significant in directly measured levels (${measuredSig.toLocaleString()} traits, FDR q < 5% in UKBB), in genetically predicted levels (${predictedSig.toLocaleString()} traits, P < 0.05 in UKBB), or to the overlap where both agree; column filters and cohort toggles refine the view.`
    ];
  }, [resp]);

  const summaryCards = useMemo(() => {
    if (!resp?.summary) return [];
    const s = resp.summary;
    return [
      {
        label: 'Metabolomic traits assessed',
        value: s.trait_count,
        helper: 'Number of NMR metabolomic traits with relative-risk estimates in this table'
      },
      {
        label: 'Significantly associated with GC (measured levels, UKBB)',
        value: s.significant_measured_count,
        helper: 'Traits whose directly measured levels are significantly associated with gastric cancer incidence in the UKBB Discovery cohort (FDR q < 0.05)'
      },
      {
        label: 'Significantly associated with GC (genetically predicted, UKBB)',
        value: s.significant_predicted_count,
        helper: 'Traits whose genetically predicted levels are significantly associated with gastric cancer incidence in the UKBB Discovery cohort (P < 0.05)'
      },
      {
        label: 'Measured and predicted effects in same direction (UKBB)',
        value: s.consistent_direction_count,
        helper: 'Traits for which directly measured and genetically predicted associations with GC point the same way (higher or lower risk) in the UKBB Discovery cohort'
      },
      {
        label: 'Significant in both measured and predicted levels (UKBB)',
        value: s.highlighted_in_ukbb_count,
        helper: 'Traits that are significant in both directly measured and genetically predicted levels in UKBB, with both effects in the same direction'
      },
      {
        label: 'Consistent effect direction in ≥3 cohorts',
        value: s.highlighted_multicohort_count,
        helper: 'Traits significant in UKBB (measured and predicted) whose genetically predicted effect direction is consistent across at least three independent cohorts (UKBB, SIT, MITS, UGCED)'
      }
    ];
  }, [resp]);

  const filteredData = useMemo(() => {
    if (!resp) return [];
    const term = searchTerm.trim().toLowerCase();
    return resp.data.filter(d => {
      const traitMatches =
        !term || formatTrait(d.trait).toLowerCase().includes(term);
      if (!traitMatches) return false;

      const measuredSig = Boolean(d.significant_measured);
      const predictedSig = Boolean(d.significant_predicted);
      const sameDirection = Boolean(d.same_direction_measured_predicted);
      const highlightUkbb = Boolean(d.highlight_ukbb_consistent);
      const highlightMulti = Boolean(d.highlight_multicohort_consistent);

      if (filters.measuredSignificant && !measuredSig) return false;
      if (filters.predictedSignificant && !predictedSig) return false;
      if (filters.consistentDirection && !sameDirection) return false;
      if (filters.highlightUkbbOnly && !highlightUkbb) return false;
      if (filters.highlightMultiOnly && !highlightMulti) return false;

      // Column-level filters
      switch (columnFilters.measured) {
        case 'significant':
          if (!measuredSig) return false;
          break;
        case 'non-significant':
          if (d.significant_measured !== false) return false;
          break;
        case 'na':
          if (d.significant_measured !== null && d.significant_measured !== undefined)
            return false;
          break;
        default:
          break;
      }

      switch (columnFilters.predicted) {
        case 'significant':
          if (!predictedSig) return false;
          break;
        case 'non-significant':
          if (d.significant_predicted !== false) return false;
          break;
        case 'na':
          if (
            d.significant_predicted !== null &&
            d.significant_predicted !== undefined
          )
            return false;
          break;
        default:
          break;
      }

      const directions = parseDirections(d.association_directions);
      const hasPositive = directions.some(token => token.includes('(+)'));
      const hasNegative = directions.some(token => token.includes('(-)'));

      switch (columnFilters.direction) {
        case 'positive':
          if (!(hasPositive && !hasNegative)) return false;
          break;
        case 'negative':
          if (!(hasNegative && !hasPositive)) return false;
          break;
        case 'mixed':
          if (!(hasPositive && hasNegative)) return false;
          break;
        case 'none':
          if (directions.length !== 0) return false;
          break;
        default:
          break;
      }

      switch (columnFilters.highlight) {
        case 'any':
          if (!(highlightUkbb || highlightMulti)) return false;
          break;
        case 'ukbb':
          if (!(highlightUkbb && !highlightMulti)) return false;
          break;
        case 'multi':
          if (!highlightMulti) return false;
          break;
        case 'none':
          if (highlightUkbb || highlightMulti) return false;
          break;
        default:
          break;
      }

      return true;
    });
  }, [resp, searchTerm, filters, columnFilters]);

  const sortedData = useMemo(() => {
    const data = [...filteredData];
    const getSortValue = (item: RiskData): number | string => {
      const key = sortState.key;
      if (key === 'trait') {
        return formatTrait(item.trait).toLowerCase();
      }
      if (key.startsWith('cohort:')) {
        const cohort = key.split(':')[1] as CohortKey;
        const field = VALUE_FIELDS[cohort][metric];
        const value = item[field];
        if (typeof value === 'number' && !Number.isNaN(value)) {
          return value;
        }
        return Number.NEGATIVE_INFINITY;
      }
      if (key === 'sigMeasured') {
        const val = item.significant_measured;
        if (val == null) return -1;
        return val ? 1 : 0;
      }
      if (key === 'sigPredicted') {
        const val = item.significant_predicted;
        if (val == null) return -1;
        return val ? 1 : 0;
      }
      if (key === 'sameDirection') {
        const val = item.same_direction_measured_predicted;
        if (val == null) return -1;
        return val ? 1 : 0;
      }
      if (key === 'consistentCombined') {
        const val = item.consistent_rr_count_measured_and_predicted;
        if (typeof val === 'number' && !Number.isNaN(val)) return val;
        return Number.NEGATIVE_INFINITY;
      }
      if (key === 'consistentGenetic') {
        const val = item.consistent_rr_count_predicted_only;
        if (typeof val === 'number' && !Number.isNaN(val)) return val;
        return Number.NEGATIVE_INFINITY;
      }
      if (key === 'highlight') {
        if (item.highlight_multicohort_consistent) return 2;
        if (item.highlight_ukbb_consistent) return 1;
        return 0;
      }
      return 0;
    };
    data.sort((a, b) => {
      const aVal = getSortValue(a);
      const bVal = getSortValue(b);
      if (typeof aVal === 'string' || typeof bVal === 'string') {
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortState.direction === 'asc' ? comparison : -comparison;
      }
      const aNum = typeof aVal === 'number' ? aVal : Number.NEGATIVE_INFINITY;
      const bNum = typeof bVal === 'number' ? bVal : Number.NEGATIVE_INFINITY;
      if (aNum === bNum) return 0;
      return sortState.direction === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return data;
  }, [filteredData, sortState, metric]);

  useEffect(() => {
    const updateWidths = () => {
      const inner = topScrollInnerRef.current;
      const tableEl = tableRef.current;
      if (!inner || !tableEl) return;
      inner.style.width = `${tableEl.scrollWidth}px`;
    };

    updateWidths();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateWidths);
    }

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && tableRef.current) {
      observer = new ResizeObserver(updateWidths);
      observer.observe(tableRef.current);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateWidths);
      }
      observer?.disconnect();
    };
  }, [selectedCohorts, metric, sortedData.length]);

  useEffect(() => {
    const topEl = topScrollRef.current;
    const bottomEl = tableScrollRef.current;
    if (!topEl || !bottomEl) return;

    let isSyncing = false;

    const handleTop = () => {
      if (isSyncing) return;
      isSyncing = true;
      bottomEl.scrollLeft = topEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    const handleBottom = () => {
      if (isSyncing) return;
      isSyncing = true;
      topEl.scrollLeft = bottomEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    topEl.addEventListener('scroll', handleTop);
    bottomEl.addEventListener('scroll', handleBottom);

    return () => {
      topEl.removeEventListener('scroll', handleTop);
      bottomEl.removeEventListener('scroll', handleBottom);
    };
  }, [selectedCohorts, metric, sortedData.length]);

  const chartData = useMemo(() => {
    return sortedData.map(d => {
      const entry: Record<string, string | number | null> = {
        trait: formatTrait(d.trait)
      };
      selectedCohorts.forEach(cohort => {
        const field = VALUE_FIELDS[cohort][metric];
        const value = d[field];
        entry[cohort] =
          typeof value === 'number' && !Number.isNaN(value) ? value : null;
      });
      return entry;
    });
  }, [sortedData, selectedCohorts, metric]);

  if (loading) {
    return <div className="p-6 flex justify-center text-gray-600">Loading...</div>;
  }

  if (!resp) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-red-600">
        Failed to load risk association data.
      </div>
    );
  }

  const totalColumns = 1 + selectedCohorts.length + 7;

  const renderSortIcon = (key: SortKey) => {
    if (sortState.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
    }
    return sortState.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">{toSentenceCaseTitle(resp.title)}</h1>
        <p className="text-gray-600 mt-1">{resp.description}</p>
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

      {notesParagraphs.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 mt-1 shrink-0" />
        <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Relative risks of gastric cancer for directly measured and genetically predicted metabolomic traits across cohorts
            </h2>
            {notesParagraphs.map((paragraph, idx) => (
              <p key={idx} className="text-sm leading-6 mt-1">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700">
            Search trait
          </label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="e.g. HDL C"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
            />
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Select cohorts
          </label>
          <div className="mt-2 flex flex-wrap gap-3">
            {COHORTS.map(cohort => {
              const active = selectedCohorts.includes(cohort.key);
              return (
                <button
                  key={cohort.key}
                  type="button"
                  onClick={() => toggleCohort(cohort.key)}
                  className={`px-3 py-1 rounded-full border font-medium transition focus:outline-none ${
                    active
                      ? 'text-white border-transparent'
                      : 'text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                  style={{
                    backgroundColor: active ? cohort.color : '#F3F4F6'
                  }}
                  title={cohort.description}
                >
                  {cohort.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <p className="text-sm font-medium text-gray-700">Filters</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {FILTER_DEFINITIONS.map(definition => (
            <label
              key={definition.key}
              className="flex items-center space-x-2 text-sm text-gray-700"
              title={definition.helper}
            >
              <input
                type="checkbox"
                checked={filters[definition.key]}
                onChange={() => toggleFilter(definition.key)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span>{definition.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Log(RR) by trait and cohort
          </h2>
          <p className="text-xs text-gray-500">
            Bars reflect natural logarithm of the relative risk; 0 indicates no effect.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ width: Math.max(chartData.length * 90, 640) }}>
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="trait"
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                  height={70}
                />
                <YAxis
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(value: number) =>
                    value.toFixed(METRIC_DECIMALS[metric] - 1)
                  }
                />
                <ReferenceLine
                  y={0}
                  stroke="#6B7280"
                  strokeDasharray="3 3"
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(2, 6, 23, 0.96)',
                    border: '1px solid rgba(103, 232, 249, 0.35)',
                    borderRadius: 8,
                    color: '#f8fafc',
                    boxShadow: '0 18px 44px rgba(0, 0, 0, 0.42)'
                  }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                  itemStyle={{ color: '#e5e7eb' }}
                  cursor={{ fill: 'rgba(103, 232, 249, 0.08)' }}
                  formatter={(value: number, name: string) => {
                    if (typeof value !== 'number') {
                      return ['-', name];
                    }
                    return [
                      `${value.toFixed(3)} (RR ${Math.exp(value).toFixed(2)})`,
                      name
                    ];
                  }}
                  labelFormatter={label => label as string}
                />
                <Legend verticalAlign="top" />
                {selectedCohorts.map(cohort => {
                  const cohortMeta = COHORTS.find(item => item.key === cohort);
                  return (
                    <Bar
                      key={cohort}
                      dataKey={cohort}
                      name={cohortMeta?.label ?? cohort}
                      fill={cohortMeta?.color ?? '#94a3b8'}
                      barSize={28}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Detailed data</h2>
          <p className="text-sm text-gray-500">
            Displaying {sortedData.length.toLocaleString()} of{' '}
            {resp.data.length.toLocaleString()} traits
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 text-xs text-slate-300">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Column definition
          </p>
          <div className="mt-2 space-y-1.5 leading-relaxed">
            <p>
              <span className="font-semibold text-slate-100">Trait:</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.trait}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Cohort columns:</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.cohortMetric}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Sig. (Measured):</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.sigMeasured}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Sig. (Genetic):</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.sigPredicted}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Same direction:</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.sameDirection}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Consistent (M+G):</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.consistentCombined}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Consistent (Genetic):</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.consistentGenetic}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Highlights:</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.highlight}</span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Directions:</span>{' '}
              <span>{COLUMN_DESCRIPTIONS.directions}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Column filters
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Sig. (Measured)</p>
              <Select
                value={columnFilters.measured}
                onValueChange={value =>
                  updateColumnFilter('measured', value as ColumnFilterState['measured'])
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="significant">Significant</SelectItem>
                  <SelectItem value="non-significant">Not significant</SelectItem>
                  <SelectItem value="na">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Sig. (Genetic)</p>
              <Select
                value={columnFilters.predicted}
                onValueChange={value =>
                  updateColumnFilter(
                    'predicted',
                    value as ColumnFilterState['predicted']
                  )
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="significant">Significant</SelectItem>
                  <SelectItem value="non-significant">Not significant</SelectItem>
                  <SelectItem value="na">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Directions</p>
              <Select
                value={columnFilters.direction}
                onValueChange={value =>
                  updateColumnFilter(
                    'direction',
                    value as ColumnFilterState['direction']
                  )
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="positive">All positive</SelectItem>
                  <SelectItem value="negative">All negative</SelectItem>
                  <SelectItem value="mixed">Mixed directions</SelectItem>
                  <SelectItem value="none">No direction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Highlights</p>
              <Select
                value={columnFilters.highlight}
                onValueChange={value =>
                  updateColumnFilter(
                    'highlight',
                    value as ColumnFilterState['highlight']
                  )
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="any">Any highlight</SelectItem>
                  <SelectItem value="ukbb">UKBB highlight only</SelectItem>
                  <SelectItem value="multi">≥3 cohorts consistent</SelectItem>
                  <SelectItem value="none">No highlight</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TooltipProvider delayDuration={150}>
          <div className="relative mt-5">
            <div
              ref={topScrollRef}
              className="-mx-6 mb-2 overflow-x-auto overflow-y-hidden px-6"
              aria-hidden="true"
            >
              <div ref={topScrollInnerRef} className="h-2" />
            </div>
            <div
              ref={tableScrollRef}
              className="-mx-6 max-h-[540px] overflow-auto px-6"
            >
              <table
                ref={tableRef}
                className="min-w-full divide-y divide-gray-200 text-sm"
              >
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('trait')}
                        className="flex w-full items-center justify-between gap-2 text-left hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                Trait
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.trait}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('trait')}
                      </button>
              </th>
                    {selectedCohorts.map(cohort => (
                      <th
                        key={cohort}
                        className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        <button
                          type="button"
                          onClick={() => requestSort(getCohortSortKey(cohort))}
                          className="flex w-full items-center justify-end gap-2 text-right hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                        >
                          <span className="flex items-center gap-1">
                            <span className="text-right">
                              {COHORTS.find(item => item.key === cohort)?.label}{' '}
                              <span className="text-gray-400">
                                (Log(RR))
                              </span>
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                  <Info className="h-3 w-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-left">
                                {COHORTS.find(item => item.key === cohort)?.description}{' '}
                                {COLUMN_DESCRIPTIONS.cohortMetric}
                              </TooltipContent>
                            </Tooltip>
                          </span>
                          {renderSortIcon(getCohortSortKey(cohort))}
                        </button>
                </th>
              ))}
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('sigMeasured')}
                        className="flex items-center justify-center gap-2 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                          Sig. (Measured)
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.sigMeasured}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('sigMeasured')}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('sigPredicted')}
                        className="flex items-center justify-center gap-2 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                          Sig. (Genetic)
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.sigPredicted}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('sigPredicted')}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('sameDirection')}
                        className="flex items-center justify-center gap-2 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                          Same direction
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.sameDirection}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('sameDirection')}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('consistentCombined')}
                        className="flex items-center justify-center gap-2 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                          Consistent (M+G)
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.consistentCombined}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('consistentCombined')}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('consistentGenetic')}
                        className="flex items-center justify-center gap-2 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                          Consistent (Genetic)
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.consistentGenetic}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('consistentGenetic')}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <button
                        type="button"
                        onClick={() => requestSort('highlight')}
                        className="flex items-center justify-center gap-2 hover:text-blue-600 focus:outline-none focus-visible:text-blue-600"
                      >
                        <span className="flex items-center gap-1">
                          Highlights
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {COLUMN_DESCRIPTIONS.highlight}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        {renderSortIcon('highlight')}
                      </button>
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center gap-1">
                        Directions
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400 hover:text-blue-600">
                              <Info className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {COLUMN_DESCRIPTIONS.directions}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
                  {sortedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={totalColumns}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        No traits match the current search and filter settings.
                      </td>
                    </tr>
                  ) : (
                    sortedData.map(trait => {
                      const isHighlighted = Boolean(
                        trait.highlight_multicohort_consistent ||
                          trait.highlight_ukbb_consistent
                      );
                      const highlightClass = trait.highlight_multicohort_consistent
                        ? 'border-l-4 border-blue-400 bg-blue-950/35'
                        : trait.highlight_ukbb_consistent
                        ? 'border-l-4 border-emerald-950/35'
                        : 'border-l-4 border-transparent';
                      const rowClass = `${highlightClass} ${
                        isHighlighted ? '' : 'odd:bg-slate-50/40 even:bg-white'
                      } hover:bg-indigo-50/50 transition`;
                      const directions = parseDirections(trait.association_directions);
                      return (
                        <tr key={trait.trait} className={rowClass}>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-900">
                            {formatTrait(trait.trait)}
                </td>
                          {selectedCohorts.map(cohort => {
                            const field = VALUE_FIELDS[cohort][metric];
                            const rawValue = trait[field];
                            const value =
                              typeof rawValue === 'number' && !Number.isNaN(rawValue)
                                ? rawValue
                                : null;
                            return (
                              <td
                                key={cohort}
                                className="px-4 py-2.5 whitespace-nowrap text-right text-gray-700"
                              >
                                {formatMetricValue(value, metric)}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            {trait.significant_measured == null ? (
                              <span className="text-gray-400 text-sm">n/a</span>
                            ) : trait.significant_measured ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            {trait.significant_predicted == null ? (
                              <span className="text-gray-400 text-sm">n/a</span>
                            ) : trait.significant_predicted ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            {trait.same_direction_measured_predicted == null ? (
                              <span className="text-gray-400 text-sm">n/a</span>
                            ) : trait.same_direction_measured_predicted ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-sky-200 text-sky-900 border border-sky-300">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center text-gray-700">
                            {formatCount(
                              trait.consistent_rr_count_measured_and_predicted
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center text-gray-700">
                            {formatCount(trait.consistent_rr_count_predicted_only)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              {trait.highlight_ukbb_consistent && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                                  UKBB
                                </span>
                              )}
                              {trait.highlight_multicohort_consistent && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-200 text-blue-900 border border-blue-300">
                                  Multi
                                </span>
                              )}
                              {!trait.highlight_ukbb_consistent &&
                                !trait.highlight_multicohort_consistent && (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-2">
                              {directions.map((token, idx) => {
                                const positive = token.includes('(+)');
                                const negative = token.includes('(-)');
                                const badgeClass = positive
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : negative
                                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                  : 'bg-gray-50 text-gray-600 border border-gray-200';
                                return (
                                  <span
                                    key={`${token}-${idx}`}
                                    className={`px-2 py-1 text-xs font-medium rounded-full ${badgeClass}`}
                                  >
                                    {token}
                                  </span>
                                );
                              })}
                              {directions.length === 0 && (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </div>
                  </td>
              </tr>
                      );
                    })
                  )}
          </tbody>
        </table>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

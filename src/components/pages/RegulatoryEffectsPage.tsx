import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Filter,
  Gauge,
  Search,
  Target,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import RegulatoryChessboard from '../RegulatoryChessboard';

const ANCESTRY_DEFS = [
  { key: 'effect_europeans', label: 'Europeans', short: 'EUR' },
  { key: 'effect_finns', label: 'Finns', short: 'FIN' },
  { key: 'effect_nonfinnish_europeans', label: 'Non-Finnish Europeans', short: 'NFE' },
  { key: 'effect_south_asians', label: 'South Asians', short: 'SAS' },
  { key: 'effect_east_asians', label: 'East Asians', short: 'EAS' },
  { key: 'effect_africans', label: 'Africans', short: 'AFR' }
] as const;

type AncestryKey = (typeof ANCESTRY_DEFS)[number]['key'];

type DirectionCategory = 'positive' | 'negative' | 'balanced' | 'leansPositive' | 'leansNegative' | 'none';

interface RegulatoryMeta {
  title: string;
  description: string;
  source_file?: string;
  generated_at?: string;
}

interface RawPairRow {
  regionTrait: string;
  regionLabel: string;
  trait: string;
  gim: string;
  regionId: string;
  regionStart: number | null;
  regionEnd: number | null;
  chromosome: number | null;
  leadVariants: string[];
  effects: Record<AncestryKey, number | null>;
  positiveCount: number;
  negativeCount: number;
  availableCount: number;
}

interface RawPairResponse {
  title?: string;
  description?: string;
  source_file?: string;
  generated_at?: string;
  ancestries?: Record<AncestryKey, string>;
  rows: RawPairRow[];
}

interface RegulatoryPair {
  id: string;
  trait: string;
  regionLabel: string;
  gim: string;
  regionId: string;
  chromosome: number | null;
  regionStart: number | null;
  regionEnd: number | null;
  cytoband: string;
  leadVariants: string[];
  effects: Record<AncestryKey, number | null>;
  availableCount: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  averageEffect: number | null;
  averageAbsEffect: number | null;
  maxAbsEffect: number | null;
  grade: number | null;
  direction: DirectionCategory;
}

type SortKey =
  | 'trait'
  | 'region'
  | 'grade'
  | 'direction'
  | 'available'
  | 'avgEffect'
  | 'maxEffect'
  | 'focus';

const DIRECTION_LABELS: Record<DirectionCategory, string> = {
  positive: 'All positive',
  negative: 'All negative',
  balanced: 'Balanced',
  leansPositive: 'Leans positive',
  leansNegative: 'Leans negative',
  none: 'No signal'
};

const numericSortKeys = new Set<SortKey>(['grade', 'available', 'avgEffect', 'maxEffect', 'focus']);

const classifyDirection = (positive: number, negative: number): DirectionCategory => {
  if (positive === 0 && negative === 0) return 'none';
  if (positive > 0 && negative === 0) return 'positive';
  if (negative > 0 && positive === 0) return 'negative';
  if (positive === negative) return 'balanced';
  return positive > negative ? 'leansPositive' : 'leansNegative';
};

const gradeBadgeClass = (grade: number | null) => {
  if (grade === null) return 'bg-slate-100 text-slate-600 border border-slate-200';
  if (grade >= 6) return 'bg-indigo-600 text-white border border-indigo-600';
  if (grade >= 5) return 'bg-blue-600 text-white border border-blue-600';
  if (grade >= 4) return 'bg-amber-500 text-white border border-amber-500';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
};

const directionBadgeClass = (direction: DirectionCategory) => {
  switch (direction) {
    case 'positive':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'negative':
      return 'bg-rose-100 text-rose-700 border border-rose-200';
    case 'balanced':
      return 'bg-sky-100 text-sky-700 border border-sky-200';
    case 'leansPositive':
      return 'bg-teal-100 text-teal-700 border border-teal-200';
    case 'leansNegative':
      return 'bg-orange-100 text-orange-700 border border-orange-200';
    case 'none':
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
};

const effectBadgeClass = (value: number | null) => {
  if (value === null) return 'bg-slate-100 text-slate-600 border border-slate-200';
  if (value > 0) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (value < 0) return 'bg-rose-100 text-rose-700 border border-rose-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
};

const formatEffect = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return 'N/A';
  const fixed = value.toFixed(3);
  return value > 0 ? `+${fixed}` : fixed;
};

const formatDecimal = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
};

const formatInteger = (value: number) => new Intl.NumberFormat('en-US').format(value);

const formatPercentage = (value: number | null, digits = 0) => {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
};

const formatRegionLabel = (record: {
  chromosome: number | null;
  regionStart: number | null;
  regionEnd: number | null;
  cytoband: string;
}) => {
  const { chromosome, regionStart, regionEnd, cytoband } = record;

  if (chromosome && regionStart && regionEnd) {
    const formatted = `${chromosome}:${regionStart.toLocaleString()}–${regionEnd.toLocaleString()}`;
    return cytoband ? `${cytoband} · ${formatted}` : formatted;
  }

  if (chromosome && (regionStart || regionEnd)) {
    const start = regionStart?.toLocaleString() ?? '—';
    const end = regionEnd?.toLocaleString() ?? '—';
    return cytoband ? `${cytoband} · ${chromosome}:${start}–${end}` : `${chromosome}:${start}–${end}`;
  }

  if (cytoband) {
    return cytoband;
  }

  return 'Region not specified';
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
};

const getSortValue = (
  record: RegulatoryPair,
  key: SortKey,
  focus: 'all' | AncestryKey
): number | string | null => {
  switch (key) {
    case 'trait':
      return record.trait;
    case 'region':
      return record.regionLabel;
    case 'grade':
      return record.grade;
    case 'direction':
      return DIRECTION_LABELS[record.direction];
    case 'available':
      return record.availableCount;
    case 'avgEffect':
      return record.averageEffect;
    case 'maxEffect':
      return record.maxAbsEffect;
    case 'focus':
      if (focus === 'all') return record.averageEffect;
      return record.effects[focus] ?? null;
    default:
      return null;
  }
};

const transformPairRow = (row: RawPairRow): RegulatoryPair => {
  const effects = {} as Record<AncestryKey, number | null>;
  ANCESTRY_DEFS.forEach(def => {
    const value = row.effects?.[def.key];
    effects[def.key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  });

  const effectValues = Object.values(effects).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
  const availableCount = effectValues.length || row.availableCount || 0;
  const positiveCount = row.positiveCount ?? 0;
  const negativeCount = row.negativeCount ?? 0;
  const zeroCount = effectValues.filter(value => value === 0).length;

  const averageEffect =
    availableCount > 0 ? effectValues.reduce((sum, value) => sum + value, 0) / availableCount : null;
  const averageAbsEffect =
    availableCount > 0
      ? effectValues.reduce((sum, value) => sum + Math.abs(value), 0) / availableCount
      : null;
  const maxAbsEffect =
    availableCount > 0 ? Math.max(...effectValues.map(value => Math.abs(value))) : null;
  const grade = Math.abs(positiveCount - negativeCount) || null;
  const direction = classifyDirection(positiveCount, negativeCount);

  return {
    id: `${row.regionLabel}__${row.trait}`,
    trait: row.trait,
    regionLabel: row.regionLabel,
    gim: row.gim,
    regionId: row.regionId,
    chromosome: row.chromosome ?? null,
    regionStart: row.regionStart ?? null,
    regionEnd: row.regionEnd ?? null,
    cytoband: row.regionLabel,
    leadVariants: [...row.leadVariants].sort((a, b) => a.localeCompare(b)),
    effects,
    availableCount,
    positiveCount,
    negativeCount,
    zeroCount,
    averageEffect,
    averageAbsEffect,
    maxAbsEffect,
    grade,
    direction
  };
};

const RegulatoryEffectsPage: React.FC = () => {
  const [meta, setMeta] = useState<RegulatoryMeta | null>(null);
  const [pairs, setPairs] = useState<RegulatoryPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [minGrade, setMinGrade] = useState<number>(1);
  const [minAncestries, setMinAncestries] = useState<number>(0);
  const [directionFilter, setDirectionFilter] = useState<'any' | DirectionCategory>('any');
  const [focusAncestry, setFocusAncestry] = useState<'all' | AncestryKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('region');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [chessboardSelectedRegion, setChessboardSelectedRegion] = useState<string | null>(null);
  const [chessboardSelectedTrait, setChessboardSelectedTrait] = useState<string | null>(null);
  const [gimContextFilter, setGimContextFilter] = useState<'all' | 'Gastric cancer' | 'Gastric lesion progression'>('all');

  const itemsPerPage = 18;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const res = await fetch(`${import.meta.env.BASE_URL}data/regulatory_pairs_2026.json`);
        if (!res.ok) {
          throw new Error('Request failed');
        }

        const json: RawPairResponse = await res.json();
        const parsed = (json.rows ?? []).map(transformPairRow);

        setMeta({
          title: json.title ?? 'Regulatory effects explorer',
          description: json.description ?? '',
          source_file: json.source_file,
          generated_at: json.generated_at
        });
        setPairs(parsed);
        setSelectedId(parsed.length ? parsed[0].id : null);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load regulatory effects');
        toast.error('Failed to load regulatory effects data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const pairRecords = useMemo(() => pairs, [pairs]);

  const globalSummary = useMemo(() => {
    if (!pairRecords.length) {
      return {
        totalPairs: 0,
        uniqueTraits: 0,
        uniqueVariants: 0,
        highGrade: 0,
        ultraGrade: 0
      };
    }

    const traitSet = new Set<string>();
    const variantSet = new Set<string>();
    let highGrade = 0;
    let ultraGrade = 0;

    pairRecords.forEach(record => {
      traitSet.add(record.trait);
      record.leadVariants.forEach(variant => variantSet.add(variant));
      if ((record.grade ?? 0) >= 5) highGrade += 1;
      if ((record.grade ?? 0) >= 6) ultraGrade += 1;
    });

    return {
      totalPairs: pairRecords.length,
      uniqueTraits: traitSet.size,
      uniqueVariants: variantSet.size,
      highGrade,
      ultraGrade
    };
  }, [pairRecords]);

  // Base filtered records (for chessboard) - only basic filters
  // Note: Some pairs have gim === "Gastric cancer & Gastric lesion progression" and should appear in both contexts
  const baseFilteredRecords = useMemo(() => {
    return pairRecords.filter(record => {
      if (record.grade === null || record.grade < minGrade) return false;
      if (record.availableCount < minAncestries) return false;
      // Filter by GIM context if specified
      if (gimContextFilter !== 'all') {
        // Include pairs that match the filter OR pairs that belong to both contexts
        if (record.gim !== gimContextFilter && record.gim !== 'Gastric cancer & Gastric lesion progression') {
          return false;
        }
      }
      return true;
    });
  }, [pairRecords, minGrade, minAncestries, gimContextFilter]);

  // Fully filtered records (for table) - includes all filters including chessboard selection
  const filteredRecords = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();

    return baseFilteredRecords.filter(record => {
      if (directionFilter !== 'any' && record.direction !== directionFilter) return false;

      // Filter by chessboard selection
      if (chessboardSelectedRegion && record.regionLabel !== chessboardSelectedRegion) return false;
      if (chessboardSelectedTrait && record.trait !== chessboardSelectedTrait) return false;

      if (lowerSearch) {
        const haystack = [
          record.trait,
          record.regionLabel,
          record.cytoband,
          record.regionId,
          record.gim,
          record.leadVariants.join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(lowerSearch)) return false;
      }

      return true;
    });
  }, [baseFilteredRecords, searchTerm, directionFilter, chessboardSelectedRegion, chessboardSelectedTrait]);

  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    sorted.sort((a, b) => {
      const factor = sortDirection === 'asc' ? 1 : -1;
      const valueA = getSortValue(a, sortKey, focusAncestry);
      const valueB = getSortValue(b, sortKey, focusAncestry);

      if (numericSortKeys.has(sortKey)) {
        const numA = typeof valueA === 'number' ? valueA : null;
        const numB = typeof valueB === 'number' ? valueB : null;
        const safeA =
          numA === null
            ? sortDirection === 'asc'
              ? Number.POSITIVE_INFINITY
              : Number.NEGATIVE_INFINITY
            : numA;
        const safeB =
          numB === null
            ? sortDirection === 'asc'
              ? Number.POSITIVE_INFINITY
              : Number.NEGATIVE_INFINITY
            : numB;
        if (safeA === safeB) return 0;
        return safeA > safeB ? factor : -factor;
      }

      const strA = String(valueA ?? '').toLowerCase();
      const strB = String(valueB ?? '').toLowerCase();
      return strA.localeCompare(strB) * factor;
    });
    return sorted;
  }, [filteredRecords, sortKey, sortDirection, focusAncestry]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / itemsPerPage));

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedRecords.slice(start, start + itemsPerPage);
  }, [sortedRecords, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, minGrade, minAncestries, directionFilter, focusAncestry, sortKey, sortDirection, chessboardSelectedRegion, chessboardSelectedTrait]);

  useEffect(() => {
    if (!filteredRecords.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId(prev =>
      prev && filteredRecords.some(record => record.id === prev) ? prev : filteredRecords[0].id
    );
  }, [filteredRecords]);

  const selectedRecord = useMemo(
    () => (selectedId ? pairRecords.find(record => record.id === selectedId) ?? null : null),
    [pairRecords, selectedId]
  );

  const focusSummary = useMemo(() => {
    if (focusAncestry === 'all') return null;
    const values = filteredRecords
      .map(record => record.effects[focusAncestry] ?? null)
      .filter((value): value is number => value !== null);

    if (!values.length) return null;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const med = median(values);
    const positive = values.filter(value => value > 0).length;
    const negative = values.filter(value => value < 0).length;
    const neutral = values.length - positive - negative;

    return {
      count: values.length,
      mean,
      median: med,
      positive,
      negative,
      neutral,
      positiveShare: (positive / values.length) * 100,
      negativeShare: (negative / values.length) * 100,
      neutralShare: (neutral / values.length) * 100
    };
  }, [filteredRecords, focusAncestry]);

  const filteredSummary = useMemo(() => {
    if (!filteredRecords.length) return null;

    const gradeValues = filteredRecords
      .map(record => record.grade)
      .filter((value): value is number => value !== null);
    const avgGrade = gradeValues.length
      ? gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length
      : null;

    const absEffects = filteredRecords.flatMap(record => {
      return Object.values(record.effects)
        .filter((value): value is number => value !== null)
        .map(value => Math.abs(value));
    });
    const avgAbsEffect = absEffects.length
      ? absEffects.reduce((sum, value) => sum + value, 0) / absEffects.length
      : null;
    const medianAbsEffect = median(absEffects);

    const coverageMean =
      filteredRecords.reduce((sum, record) => sum + record.availableCount, 0) /
      filteredRecords.length;
    const strongDirectionalShare =
      (filteredRecords.filter(
        record =>
          record.direction === 'positive' || record.direction === 'negative'
      ).length /
        filteredRecords.length) *
      100;

    return {
      avgGrade,
      avgAbsEffect,
      medianAbsEffect,
      coverageMean,
      strongDirectionalShare
    };
  }, [filteredRecords]);

  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'trait' || key === 'region' ? 'asc' : 'desc');
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-orange-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-orange-600" />
    );
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading regulatory effect landscape…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 max-w-lg mx-auto">
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-rose-800 mb-2">Unable to load data</h3>
          <p className="text-rose-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const focusMeta = focusAncestry === 'all' ? null : ANCESTRY_DEFS.find(item => item.key === focusAncestry);

  const openDetailsForRecord = (recordId: string) => {
    setSelectedId(recordId);
    setDetailsOpen(true);
  };

  const handleChessboardCellClick = (region: string, trait: string) => {
    // Toggle selection: if clicking the same cell, deselect
    if (chessboardSelectedRegion === region && chessboardSelectedTrait === trait) {
      setChessboardSelectedRegion(null);
      setChessboardSelectedTrait(null);
    } else {
      setChessboardSelectedRegion(region);
      setChessboardSelectedTrait(trait);
      // Find and select the corresponding record in the table
      const matchingRecord = filteredRecords.find(
        r => r.regionLabel === region && r.trait === trait
      );
      if (matchingRecord) {
        setSelectedId(matchingRecord.id);
      }
    }
  };

  return (
    <div className="p-4 max-w-[1800px] mx-auto space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(620px,760px)] gap-4 items-start">
        <div className="space-y-2 w-full">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-orange-400" />
            <span>{meta?.title ?? 'Regulatory effects explorer'}</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">{meta?.description}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="h-full border-slate-700 bg-slate-950/70 text-slate-100">
            <CardContent className="h-24 p-3 flex flex-col items-center justify-center gap-2 text-center">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-xs font-semibold text-slate-300">Region–trait pairs</p>
                <p className="text-xl font-bold text-slate-50">{formatInteger(globalSummary.totalPairs)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-slate-700 bg-slate-950/70 text-slate-100">
            <CardContent className="h-24 p-3 flex flex-col items-center justify-center gap-2 text-center">
              <Target className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-xs font-semibold text-slate-300">Unique metabolomic traits</p>
                <p className="text-xl font-bold text-slate-50">{formatInteger(globalSummary.uniqueTraits)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-slate-700 bg-slate-950/70 text-slate-100">
            <CardContent className="h-24 p-3 flex flex-col items-center justify-center gap-2 text-center">
              <Gauge className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-xs font-semibold text-slate-300">Unique lead variants</p>
                <p className="text-xl font-bold text-slate-50">{formatInteger(globalSummary.uniqueVariants)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full border-slate-700 bg-slate-950/70 text-slate-100">
            <CardContent className="h-24 p-3 flex flex-col items-center justify-center gap-1 text-center">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              <p className="text-xs font-semibold text-slate-300">Harmony grade ≥ 5 (≥ 6)</p>
              <p className="text-xl font-bold text-slate-50">
                {formatInteger(globalSummary.highGrade)}{' '}
                <span className="text-sm text-slate-400">({formatInteger(globalSummary.ultraGrade)})</span>
              </p>
              <p className="text-[10px] text-slate-400">Grade 1–6; 6 is most consistent</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm border border-slate-700 bg-slate-950/85 text-slate-100 overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-slate-800">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-400" />
                Regulatory effects matrix and pairs
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">
                Controls apply to both the matrix and the table. Click a matrix cell to filter the table to that region–trait pair.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-300">GIM context</label>
                <Select
                  value={gimContextFilter}
                  onValueChange={value => setGimContextFilter(value as typeof gimContextFilter)}
                >
                  <SelectTrigger className="h-8 w-[210px] border-slate-700 bg-slate-900 text-xs text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All contexts</SelectItem>
                    <SelectItem value="Gastric cancer">Gastric cancer</SelectItem>
                    <SelectItem value="Gastric lesion progression">Gastric lesion progression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(chessboardSelectedRegion || chessboardSelectedTrait) && (
                <button
                  onClick={() => {
                    setChessboardSelectedRegion(null);
                    setChessboardSelectedTrait(null);
                  }}
                  className="h-8 px-3 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md shadow-md transition-colors"
                >
                  Clear matrix selection
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/65 p-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-[1.1fr_0.9fr_0.9fr_1fr_0.9fr] gap-3 items-end">
              <div className="flex flex-col">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input
                    placeholder="Search trait, region, lead variants…"
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    className="pl-9 h-9 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Ancestry</label>
                <Select value={focusAncestry} onValueChange={value => setFocusAncestry(value as typeof focusAncestry)}>
                  <SelectTrigger className="h-9 border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue placeholder="All ancestries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ancestries</SelectItem>
                    {ANCESTRY_DEFS.map(def => (
                      <SelectItem key={def.key} value={def.key}>
                        {def.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Directional signature</label>
                <Select
                  value={directionFilter}
                  onValueChange={value => setDirectionFilter(value as typeof directionFilter)}
                >
                  <SelectTrigger className="h-9 border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue placeholder="All patterns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any direction</SelectItem>
                    <SelectItem value="positive">All positive</SelectItem>
                    <SelectItem value="negative">All negative</SelectItem>
                    <SelectItem value="balanced">Balanced</SelectItem>
                    <SelectItem value="leansPositive">Leans positive</SelectItem>
                    <SelectItem value="leansNegative">Leans negative</SelectItem>
                    <SelectItem value="none">No signal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-300">Minimum harmony grade</label>
                  <Badge className="min-w-10 justify-center border border-cyan-500/40 bg-cyan-950/70 text-cyan-200">
                    ≥ {minGrade}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[minGrade]}
                    min={1}
                    max={6}
                    step={1}
                    onValueChange={([value]) => setMinGrade(value ?? minGrade)}
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                  Grade 1–6 summarises cross-ancestry agreement; higher means more consistent signals.
                </p>
              </div>

              <div className="flex flex-col">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Required ancestry coverage</label>
                <Select value={String(minAncestries)} onValueChange={value => setMinAncestries(Number(value))}>
                  <SelectTrigger className="h-9 border-slate-700 bg-slate-950 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map(option => (
                      <SelectItem key={option} value={String(option)}>
                        {option === 0 ? 'No minimum' : `At least ${option}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                  Counts ancestries with non-null effect estimates.
                </p>
              </div>
            </div>

            {(filteredSummary || (focusSummary && focusMeta)) && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 text-xs">
                {filteredSummary && (
                  <>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">Avg grade</p>
                      <p className="font-semibold text-slate-100">{formatDecimal(filteredSummary.avgGrade, 2)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">Avg |effect|</p>
                      <p className="font-semibold text-slate-100">{formatDecimal(filteredSummary.avgAbsEffect, 3)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">Median |effect|</p>
                      <p className="font-semibold text-slate-100">{formatDecimal(filteredSummary.medianAbsEffect, 3)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">Mean coverage</p>
                      <p className="font-semibold text-slate-100">{formatDecimal(filteredSummary.coverageMean, 1)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">Unidirectional</p>
                      <p className="font-semibold text-slate-100">{formatPercentage(filteredSummary.strongDirectionalShare, 0)}</p>
                    </div>
                  </>
                )}
                {focusSummary && focusMeta && (
                  <>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">{focusMeta.short} estimates</p>
                      <p className="font-semibold text-slate-100">{formatInteger(focusSummary.count)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                      <p className="text-slate-500">{focusMeta.short} mean</p>
                      <p className="font-semibold text-slate-100">{formatEffect(focusSummary.mean)}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(760px,1.12fr)_minmax(560px,0.88fr)] gap-4 items-stretch">
            <section className="min-w-0 rounded-lg border border-slate-800 bg-black/40 p-3">
              <div className="mb-2 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Matrix view</h2>
                  <p className="text-xs text-slate-400">
                    Cell color encodes harmony grade. Click a cell to focus the pairs table.
                  </p>
                </div>
                <Badge className="w-fit border border-slate-700 bg-slate-900 text-slate-200">
                  {formatInteger(baseFilteredRecords.length)} matrix pairs
                </Badge>
              </div>

              <RegulatoryChessboard
                data={baseFilteredRecords.map(record => ({
                  id: record.id,
                  trait: record.trait,
                  regionLabel: record.regionLabel,
                  availableCount: record.availableCount,
                  positiveCount: record.positiveCount,
                  negativeCount: record.negativeCount,
                  grade: record.grade,
                  maxAbsEffect: record.maxAbsEffect,
                  gim: record.gim
                }))}
                onCellClick={handleChessboardCellClick}
                selectedRegion={chessboardSelectedRegion}
                selectedTrait={chessboardSelectedTrait}
                gimFilter={gimContextFilter}
              />
            </section>

            <section className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/70 flex flex-col overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 px-3 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-orange-400" />
                    Regulatory pairs ({filteredRecords.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sort columns or open details without leaving the matrix context.
                  </p>
                </div>
                {(chessboardSelectedRegion || chessboardSelectedTrait) && (
                  <Badge className="w-fit border border-cyan-500/40 bg-cyan-950/70 text-cyan-200">
                    Matrix filtered
                  </Badge>
                )}
              </div>

              <div className="min-h-[520px] max-h-[68vh] overflow-auto">
                <Table className="min-w-[980px] text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-slate-950/95">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead
                        className="min-w-[190px] cursor-pointer text-slate-300"
                        onClick={() => requestSort('region')}
                      >
                        Region {getSortIcon('region')}
                      </TableHead>
                      <TableHead
                        className="min-w-[160px] cursor-pointer text-slate-300"
                        onClick={() => requestSort('trait')}
                      >
                        Trait {getSortIcon('trait')}
                      </TableHead>
                      <TableHead className="min-w-[150px] text-center text-slate-300">
                        Details
                      </TableHead>
                      <TableHead
                        className="min-w-[110px] text-center cursor-pointer text-slate-300"
                        onClick={() => requestSort('grade')}
                      >
                        Harmony grade {getSortIcon('grade')}
                      </TableHead>
                      <TableHead
                        className="min-w-[140px] text-center cursor-pointer text-slate-300"
                        onClick={() => requestSort('direction')}
                      >
                        Direction {getSortIcon('direction')}
                      </TableHead>
                      <TableHead
                        className="min-w-[95px] text-center cursor-pointer text-slate-300"
                        onClick={() => requestSort('available')}
                      >
                        Coverage {getSortIcon('available')}
                      </TableHead>
                      <TableHead
                        className="min-w-[115px] text-center cursor-pointer text-slate-300"
                        onClick={() => requestSort('avgEffect')}
                      >
                        Avg effect {getSortIcon('avgEffect')}
                      </TableHead>
                      <TableHead
                        className="min-w-[115px] text-center cursor-pointer text-slate-300"
                        onClick={() => requestSort('maxEffect')}
                      >
                        Max |effect| {getSortIcon('maxEffect')}
                      </TableHead>
                      {focusAncestry !== 'all' && (
                        <TableHead
                          className="min-w-[130px] text-center cursor-pointer text-slate-300"
                          onClick={() => requestSort('focus')}
                        >
                          {focusMeta ? `${focusMeta.short} effect` : 'Selected ancestry effect'} {getSortIcon('focus')}
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map(record => {
                      const isActive = record.id === selectedId;
                      const focusValue =
                        focusAncestry === 'all'
                          ? null
                          : record.effects[focusAncestry] ?? null;
                      return (
                        <TableRow
                          key={record.id}
                          className={`cursor-pointer border-slate-800 transition-colors ${
                            isActive ? 'bg-orange-950/35 border-l-4 border-orange-500' : 'hover:bg-slate-900/70'
                          }`}
                          onClick={() => setSelectedId(record.id)}
                        >
                          <TableCell className="text-slate-300">{record.regionLabel}</TableCell>
                          <TableCell className="font-medium text-slate-100">{record.trait}</TableCell>
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                openDetailsForRecord(record.id);
                              }}
                              className="text-xs font-semibold text-orange-300 hover:text-orange-200"
                            >
                              Open details
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${gradeBadgeClass(record.grade)} px-2`}>
                              {record.grade ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${directionBadgeClass(record.direction)} px-2`}>
                              {DIRECTION_LABELS[record.direction]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-slate-300">
                            {record.availableCount}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${effectBadgeClass(record.averageEffect)} px-2`}>
                              {formatEffect(record.averageEffect)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-slate-300">
                            {formatDecimal(record.maxAbsEffect, 3)}
                          </TableCell>
                          {focusAncestry !== 'all' && (
                            <TableCell className="text-center">
                              <Badge className={`${effectBadgeClass(focusValue)} px-2`}>
                                {formatEffect(focusValue)}
                              </Badge>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                    {!paginatedRecords.length && (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={focusAncestry === 'all' ? 8 : 9} className="py-8 text-center text-slate-400">
                          No region–trait pairs satisfy the current filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
                <span>
                  Page {Math.min(currentPage, totalPages)} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border border-slate-700 text-slate-200 disabled:opacity-40 hover:bg-slate-900"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border border-slate-700 text-slate-200 disabled:opacity-40 hover:bg-slate-900"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

        <Dialog
          open={detailsOpen && !!selectedRecord}
          onOpenChange={open => setDetailsOpen(open)}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                {selectedRecord ? `Regulation details · ${selectedRecord.regionLabel}` : 'Regulation details'}
              </DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="flex-1 overflow-y-auto space-y-5 text-sm text-slate-700 pr-4">
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <span className="font-semibold text-slate-800">Region:</span>{' '}
                    <span>{formatRegionLabel(selectedRecord)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Metabolomic trait:</span>{' '}
                    <span>{selectedRecord.trait}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">GIM context:</span>{' '}
                    <span>{selectedRecord.gim || '—'}</span>
                  </div>
                  {selectedRecord.regionId && (
                    <div>
                      <span className="font-semibold text-slate-800">Region ID:</span>{' '}
                      <span>{selectedRecord.regionId}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Harmony grade:</span>
                    <Badge className={`${gradeBadgeClass(selectedRecord.grade)} px-2`}>
                      {selectedRecord.grade ?? '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Directional signature:</span>
                    <Badge className={`${directionBadgeClass(selectedRecord.direction)} px-2`}>
                      {DIRECTION_LABELS[selectedRecord.direction]}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Ancestry coverage:</span>{' '}
                    <span>{selectedRecord.availableCount} groups</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Positive / negative:</span>{' '}
                    <span>
                      {selectedRecord.positiveCount} / {selectedRecord.negativeCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Average effect:</span>
                    <Badge className={`${effectBadgeClass(selectedRecord.averageEffect)} px-2`}>
                      {formatEffect(selectedRecord.averageEffect)}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Max |effect|:</span>{' '}
                    <span>{formatDecimal(selectedRecord.maxAbsEffect, 3)}</span>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Multi-ancestry effect profile
                    </h4>
                    {(() => {
                      const chartData = ANCESTRY_DEFS.map(def => ({
                        label: def.label,
                        key: def.key,
                        value: selectedRecord.effects[def.key]
                      })).filter(item => item.value !== null) as Array<{
                        label: string;
                        key: AncestryKey;
                        value: number;
                      }>;

                      if (!chartData.length) {
                        return (
                          <p className="text-xs text-slate-500">
                            No ancestry-specific estimates available for this pair.
                          </p>
                        );
                      }

                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                              data={chartData}
                              layout="vertical"
                              margin={{ left: 12, right: 20, top: 10, bottom: 10 }}
                            >
                              <XAxis
                                type="number"
                                tick={{ fontSize: 12 }}
                                tickFormatter={tick => Number(tick).toFixed(2)}
                              />
                              <YAxis
                                dataKey="label"
                                type="category"
                                width={140}
                                tick={{ fontSize: 12 }}
                              />
                              <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
                              <RechartsTooltip
                                formatter={(value: number) => [formatEffect(value), 'Effect']}
                                labelFormatter={label => label}
                              />
                              <Bar dataKey="value" barSize={18} radius={[4, 4, 4, 4]}>
                                {chartData.map(item => (
                                  <Cell
                                    key={item.key}
                                    fill={
                                      item.value > 0
                                        ? '#059669'
                                        : item.value < 0
                                          ? '#dc2626'
                                          : '#64748b'
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col gap-3 lg:w-[280px] xl:w-[320px]">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-800">
                        Ancestry-specific estimates
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                        {ANCESTRY_DEFS.map(def => {
                          const value = selectedRecord.effects[def.key];
                          return (
                            <div
                              key={`${selectedRecord.id}-${def.key}`}
                              className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <span className="text-xs font-semibold text-slate-600">{def.label}</span>
                              <Badge className={`${effectBadgeClass(value)} px-2`}>
                                {formatEffect(value)}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-800">
                        Lead variants ({selectedRecord.leadVariants.length})
                      </h4>
                      {selectedRecord.leadVariants.length ? (
                        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {selectedRecord.leadVariants.map(variant => (
                            <li
                              key={variant}
                              className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                            >
                              {variant}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No lead variants reported for this region–trait pair.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default RegulatoryEffectsPage;

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
  const [minGrade, setMinGrade] = useState<number>(5);
  const [minAncestries, setMinAncestries] = useState<number>(2);
  const [directionFilter, setDirectionFilter] = useState<'any' | DirectionCategory>('any');
  const [focusAncestry, setFocusAncestry] = useState<'all' | AncestryKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('region');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
          title: json.title ?? 'Regulatory Effects Explorer',
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

  const filteredRecords = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();

    return pairRecords.filter(record => {
      if (record.grade === null || record.grade < minGrade) return false;
      if (record.availableCount < minAncestries) return false;
      if (directionFilter !== 'any' && record.direction !== directionFilter) return false;

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
  }, [pairRecords, searchTerm, minGrade, minAncestries, directionFilter]);

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
  }, [searchTerm, minGrade, minAncestries, directionFilter, focusAncestry, sortKey, sortDirection]);

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

  return (
    <div className="p-6 max-w-[1500px] mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2 w-full max-w-4xl">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-orange-600" />
            <span>{meta?.title ?? 'Regulatory Effects Explorer'}</span>
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{meta?.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Region–trait pairs
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatInteger(globalSummary.totalPairs)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-3">
            <Target className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Unique metabolomic traits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatInteger(globalSummary.uniqueTraits)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-3">
            <Gauge className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Unique lead variants in the highlighted genomic regions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatInteger(globalSummary.uniqueVariants)}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Grade ≥ 5 (≥ 6)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {formatInteger(globalSummary.highGrade)}{' '}
              <span className="text-sm text-slate-500">
                ({formatInteger(globalSummary.ultraGrade)})
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border">
        <CardHeader className="pb-2 flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-600" />
          <CardTitle className="text-sm font-semibold text-slate-700">Filter and focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search trait, region, lead variants…"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Focus ancestry</label>
              <Select value={focusAncestry} onValueChange={value => setFocusAncestry(value as typeof focusAncestry)}>
                <SelectTrigger>
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

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Directional signature</label>
              <Select
                value={directionFilter}
                onValueChange={value => setDirectionFilter(value as typeof directionFilter)}
              >
                <SelectTrigger>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Minimum harmony grade</label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[minGrade]}
                  min={1}
                  max={6}
                  step={1}
                  onValueChange={([value]) => setMinGrade(value ?? minGrade)}
                />
                <Badge className="bg-slate-100 text-slate-700 border border-slate-200">≥ {minGrade}</Badge>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Required ancestry coverage</label>
              <Select value={String(minAncestries)} onValueChange={value => setMinAncestries(Number(value))}>
                <SelectTrigger>
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
          </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">What each control does</p>
            <p>
              <strong>Search</strong> scans traits, lead variants, cytobands, and formatted genomic regions.
            </p>
            <p>
              <strong>Focus ancestry</strong> adds an ancestry-specific column and summary so you can track one group at a time.
            </p>
            <p>
              <strong>Directional signature</strong> keeps only records with the chosen cross-ancestry pattern. “All positive” means every available ancestry has a positive effect estimate, “All negative” the inverse, “Balanced” mixes equal counts of positives and negatives, and the “leans” options capture cases where one sign dominates but the opposite sign is still present.
            </p>
            <p>
              <strong>Minimum harmony grade</strong> filters by evidence strength (scale 1–6). Harmony grade summarises the consistency of the ancestry signals in the source table: higher grades indicate tighter agreement across ancestries (Grade 6 is the most consistent).
            </p>
            <p>
              <strong>Ancestry coverage</strong> requires at least the selected number of ancestries with non-null effects.
            </p>
                    </div>
                  </CardContent>
                </Card>

      <div className="space-y-6">
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Regulatory pairs ({filteredRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="min-w-[220px] cursor-pointer"
                      onClick={() => requestSort('region')}
                    >
                      Region {getSortIcon('region')}
                    </TableHead>
                    <TableHead
                      className="min-w-[180px] cursor-pointer"
                      onClick={() => requestSort('trait')}
                    >
                      Trait {getSortIcon('trait')}
                    </TableHead>
                    <TableHead className="min-w-[180px] text-center">
                      Details
                    </TableHead>
                    <TableHead
                      className="min-w-[90px] text-center cursor-pointer"
                      onClick={() => requestSort('grade')}
                    >
                      Harmony grade {getSortIcon('grade')}
                    </TableHead>
                    <TableHead
                      className="min-w-[150px] text-center cursor-pointer"
                      onClick={() => requestSort('direction')}
                    >
                      Direction {getSortIcon('direction')}
                    </TableHead>
                    <TableHead
                      className="min-w-[120px] text-center cursor-pointer"
                      onClick={() => requestSort('available')}
                    >
                      Coverage {getSortIcon('available')}
                    </TableHead>
                    <TableHead
                      className="min-w-[130px] text-center cursor-pointer"
                      onClick={() => requestSort('avgEffect')}
                    >
                      Avg effect {getSortIcon('avgEffect')}
                    </TableHead>
                    <TableHead
                      className="min-w-[130px] text-center cursor-pointer"
                      onClick={() => requestSort('maxEffect')}
                    >
                      Max |effect| {getSortIcon('maxEffect')}
                    </TableHead>
                    {focusAncestry !== 'all' && (
                      <TableHead
                        className="min-w-[150px] text-center cursor-pointer"
                        onClick={() => requestSort('focus')}
                      >
                        {focusMeta ? `${focusMeta.short} effect` : 'Focus effect'} {getSortIcon('focus')}
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
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-orange-50/80 border-l-4 border-orange-500' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedId(record.id)}
                      >
                        <TableCell className="text-slate-700">{record.regionLabel}</TableCell>
                        <TableCell className="font-medium text-slate-900">{record.trait}</TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              openDetailsForRecord(record.id);
                            }}
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                          >
                            Click to see regulatory effects
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
                        <TableCell className="text-center text-sm text-slate-700">
                          {record.availableCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${effectBadgeClass(record.averageEffect)} px-2`}>
                            {formatEffect(record.averageEffect)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-slate-700">
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
                    <TableRow>
                      <TableCell colSpan={focusAncestry === 'all' ? 8 : 9} className="py-8 text-center">
                        No region–trait pairs satisfy the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-sm text-slate-500 border-t">
              <span>
                Page {Math.min(currentPage, totalPages)} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded border text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border text-slate-600 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {(filteredSummary || (focusSummary && focusMeta)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSummary && (
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    Filtered set overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Average harmony grade</span>
                    <span className="font-semibold text-slate-900">
                      {formatDecimal(filteredSummary.avgGrade, 2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Average |effect|</span>
                    <span className="font-semibold text-slate-900">
                      {formatDecimal(filteredSummary.avgAbsEffect, 3)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Median |effect|</span>
                    <span className="font-semibold text-slate-900">
                      {formatDecimal(filteredSummary.medianAbsEffect, 3)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mean ancestry coverage</span>
                    <span className="font-semibold text-slate-900">
                      {formatDecimal(filteredSummary.coverageMean, 1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Strictly unidirectional</span>
                    <span className="font-semibold text-slate-900">
                      {formatPercentage(filteredSummary.strongDirectionalShare, 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {focusSummary && focusMeta && (
              <Card className="shadow-sm border">
                <CardHeader className="pb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-600" />
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {focusMeta.label} summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Pairs with estimates</span>
                    <span className="font-semibold text-slate-900">
                      {formatInteger(focusSummary.count)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Mean effect</span>
                    <span className="font-semibold text-slate-900">
                      {formatEffect(focusSummary.mean)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Median effect</span>
                    <span className="font-semibold text-slate-900">
                      {formatEffect(focusSummary.median)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Positive direction</span>
                    <span className="font-semibold text-slate-900">
                      {formatInteger(focusSummary.positive)} · {formatPercentage(focusSummary.positiveShare, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Negative direction</span>
                    <span className="font-semibold text-slate-900">
                      {formatInteger(focusSummary.negative)} · {formatPercentage(focusSummary.negativeShare, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Near zero</span>
                    <span className="font-semibold text-slate-900">
                      {formatInteger(focusSummary.neutral)} · {formatPercentage(focusSummary.neutralShare, 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Dialog
          open={detailsOpen && !!selectedRecord}
          onOpenChange={open => setDetailsOpen(open)}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {selectedRecord ? `Regulation details · ${selectedRecord.regionLabel}` : 'Regulation details'}
              </DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-5 text-sm text-slate-700">
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
    </div>
  );
};

export default RegulatoryEffectsPage;

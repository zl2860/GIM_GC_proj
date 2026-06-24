import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Building, Crosshair, Filter, Search, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';

interface CenterMetric {
  center: string;
  performance: number | null;
}

interface AncestryMetric {
  group: string;
  performance: number | null;
}

interface TraitStats {
  center_average: number | null;
  center_best: number | null;
  center_worst: number | null;
  ancestry_average: number | null;
  ancestry_best: number | null;
  ancestry_worst: number | null;
}

interface TraitEntry {
  trait: string;
  centers: CenterMetric[];
  ancestries: AncestryMetric[];
  stats: TraitStats;
}

interface ModelAssessmentPayload {
  title: string;
  description: string;
  source_file: string;
  generated_at: string;
  center_names: string[];
  ancestry_groups: string[];
  traits: TraitEntry[];
}

interface DerivedMetric {
  name: string;
  value: number;
}

interface TraitWithDerived extends TraitEntry {
  derived: {
    bestCenter: DerivedMetric | null;
    worstCenter: DerivedMetric | null;
    bestAncestry: DerivedMetric | null;
    worstAncestry: DerivedMetric | null;
  };
}

type SortKey =
  | 'trait'
  | 'centerAverage'
  | 'centerBest'
  | 'centerWorst'
  | 'ancestryAverage'
  | 'focusCenter'
  | 'focusAncestry';

const performanceColors = (value: number | null) => {
  if (value === null || value === undefined) return 'bg-gray-100 text-gray-500';
  if (value >= 0.45) return 'bg-emerald-100 text-emerald-800';
  if (value >= 0.38) return 'bg-lime-100 text-lime-800';
  if (value >= 0.32) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

const formatValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return value.toFixed(3);
};

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const computeExtrema = (
  metrics: { name: string; value: number | null }[],
  pick: 'max' | 'min'
): DerivedMetric | null => {
  const numeric = metrics.filter(item => isNumber(item.value)) as { name: string; value: number }[];
  if (!numeric.length) {
    return null;
  }
  return numeric.reduce<DerivedMetric>((acc, item) => {
    if (pick === 'max') {
      return item.value > acc.value ? item : acc;
    }
    return item.value < acc.value ? item : acc;
  }, numeric[0]);
};

const computeSummary = (records: { trait: string; value: number }[]) => {
  if (!records.length) {
    return null;
  }
  const sorted = [...records].sort((a, b) => a.value - b.value);
  const mean = sorted.reduce((sum, item) => sum + item.value, 0) / sorted.length;
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1].value + sorted[middle].value) / 2
      : sorted[middle].value;
  const top = sorted[sorted.length - 1];
  const bottom = sorted[0];
  const highCount = sorted.filter(item => item.value >= 0.4).length;

  return { count: sorted.length, mean, median, top, bottom, highCount };
};

const getCenterValue = (trait: TraitEntry | TraitWithDerived, center: string) => {
  const record = trait.centers.find(item => item.center === center);
  return record?.performance ?? null;
};

const getAncestryValue = (trait: TraitEntry | TraitWithDerived, group: string) => {
  const record = trait.ancestries.find(item => item.group === group);
  return record?.performance ?? null;
};

const ModelAssessmentPage: React.FC = () => {
  const [payload, setPayload] = useState<ModelAssessmentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('centerAverage');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [focusCenter, setFocusCenter] = useState<'all' | string>('all');
  const [focusAncestry, setFocusAncestry] = useState<'all' | string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTraitName, setSelectedTraitName] = useState<string | null>(null);

  const itemsPerPage = 18;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.BASE_URL}data/model_assessment_2026.json`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json: ModelAssessmentPayload = await response.json();
        setPayload(json);
        setSelectedTraitName(json.traits[0]?.trait ?? null);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load model assessment data');
        toast.error('Failed to load model assessment data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const centerNames = payload?.center_names ?? [];
  const ancestryGroups = payload?.ancestry_groups ?? [];
  const decoratedTraits = useMemo<TraitWithDerived[]>(() => {
    if (!payload) return [];
    return payload.traits.map(trait => {
      const centerMetrics = trait.centers.map(item => ({
        name: item.center,
        value: item.performance
      }));
      const ancestryMetrics = trait.ancestries.map(item => ({
        name: item.group,
        value: item.performance
      }));

      return {
        ...trait,
        derived: {
          bestCenter: computeExtrema(centerMetrics, 'max'),
          worstCenter: computeExtrema(centerMetrics, 'min'),
          bestAncestry: computeExtrema(ancestryMetrics, 'max'),
          worstAncestry: computeExtrema(ancestryMetrics, 'min')
        }
      };
    });
  }, [payload]);

  const filteredTraits = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase();

    return decoratedTraits
      .filter(trait => {
        const matchesSearch = !lowerSearch || trait.trait.toLowerCase().includes(lowerSearch);

        const focusCenterAvailable =
          focusCenter === 'all' || isNumber(getCenterValue(trait, focusCenter));
        const focusAncestryAvailable =
          focusAncestry === 'all' || isNumber(getAncestryValue(trait, focusAncestry));

        return matchesSearch && focusCenterAvailable && focusAncestryAvailable;
      })
      .sort((a, b) => {
        const sortFactor = sortDirection === 'asc' ? 1 : -1;

        const compareNumbers = (valA: number | null | undefined, valB: number | null | undefined) => {
          if (!isNumber(valA) && !isNumber(valB)) return 0;
          if (!isNumber(valA)) return 1;
          if (!isNumber(valB)) return -1;
          return (valA - valB) * sortFactor;
        };
      
      switch (sortBy) {
        case 'trait':
            return a.trait.localeCompare(b.trait) * sortFactor;
          case 'centerAverage':
            return compareNumbers(a.stats.center_average, b.stats.center_average);
          case 'centerBest':
            return compareNumbers(a.derived.bestCenter?.value ?? null, b.derived.bestCenter?.value ?? null);
          case 'centerWorst':
            return compareNumbers(a.derived.worstCenter?.value ?? null, b.derived.worstCenter?.value ?? null);
          case 'ancestryAverage':
            return compareNumbers(a.stats.ancestry_average, b.stats.ancestry_average);
          case 'focusCenter':
            if (focusCenter === 'all') return compareNumbers(a.stats.center_average, b.stats.center_average);
            return compareNumbers(getCenterValue(a, focusCenter), getCenterValue(b, focusCenter));
          case 'focusAncestry':
            if (focusAncestry === 'all') {
              return compareNumbers(a.stats.ancestry_average, b.stats.ancestry_average);
            }
            return compareNumbers(getAncestryValue(a, focusAncestry), getAncestryValue(b, focusAncestry));
        default:
            return 0;
        }
      });
  }, [decoratedTraits, searchTerm, sortBy, sortDirection, focusCenter, focusAncestry]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortDirection, focusCenter, focusAncestry]);

  useEffect(() => {
    if (!filteredTraits.length) {
      setSelectedTraitName(null);
      return;
    }
    const stillValid = filteredTraits.some(trait => trait.trait === selectedTraitName);
    if (!stillValid) {
      setSelectedTraitName(filteredTraits[0].trait);
    }
  }, [filteredTraits, selectedTraitName]);

  const paginatedTraits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTraits.slice(start, start + itemsPerPage);
  }, [filteredTraits, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredTraits.length / itemsPerPage));

  const activeTrait = useMemo(
    () => filteredTraits.find(trait => trait.trait === selectedTraitName) ?? null,
    [filteredTraits, selectedTraitName]
  );

  const focusCenterSummary = useMemo(() => {
    if (focusCenter === 'all') return null;
    const metrics = filteredTraits
      .map(trait => ({
        trait: trait.trait,
        value: getCenterValue(trait, focusCenter)
      }))
      .filter((item): item is { trait: string; value: number } => isNumber(item.value));
    return computeSummary(metrics);
  }, [filteredTraits, focusCenter]);

  const focusAncestrySummary = useMemo(() => {
    if (focusAncestry === 'all') return null;
    const metrics = filteredTraits
      .map(trait => ({
        trait: trait.trait,
        value: getAncestryValue(trait, focusAncestry)
      }))
      .filter((item): item is { trait: string; value: number } => isNumber(item.value));
    return computeSummary(metrics);
  }, [filteredTraits, focusAncestry]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading UKBB CSL model assessment data...</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <Activity className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Data loading error</h3>
          <p className="text-red-600 mb-4">{error ?? 'Unknown error'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Building className="w-8 h-8 text-orange-600" />
            <span>CSL model performance</span>
            </h1>
          <p className="text-gray-600 mt-2">
            The causal stable learning (CSL) predictions were evaluated for each specific trait by assessment centers and ancestries in UKBB discovery cohort. Use the selectors to highlight a specific assessment center or reported ancestry and obtain summaries for the filtered trait set.
          </p>
          </div>
        </div>

      <div className="bg-white rounded-lg shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filter and view controls</h3>
          </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search traits</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                className="pl-10"
                placeholder="e.g. HDL_C, Glycoprotein, Lactate..."
                  value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Center</label>
            <Select value={focusCenter} onValueChange={value => setFocusCenter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All centers" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All centers</SelectItem>
                {centerNames.map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ancestry</label>
            <Select value={focusAncestry} onValueChange={value => setFocusAncestry(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All ancestries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {ancestryGroups.map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort traits by</label>
            <Select value={sortBy} onValueChange={value => setSortBy(value as SortKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="centerAverage">Center average</SelectItem>
                <SelectItem value="centerBest">Best center value</SelectItem>
                <SelectItem value="centerWorst">Lowest center value</SelectItem>
                <SelectItem value="ancestryAverage">Ancestry average</SelectItem>
                <SelectItem value="focusCenter">Selected center value</SelectItem>
                <SelectItem value="focusAncestry">Selected ancestry value</SelectItem>
                <SelectItem value="trait">Trait name</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortDirection}
              onValueChange={value => setSortDirection(value as 'asc' | 'desc')}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">High to low</SelectItem>
                <SelectItem value="asc">Low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr,1fr]">
        <Card className="shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              Trait catalogue ({filteredTraits.length})
            </CardTitle>
              </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Trait</TableHead>
                    <TableHead className="text-right min-w-[120px]">Center avg</TableHead>
                    <TableHead className="min-w-[160px]">Top center</TableHead>
                    <TableHead className="min-w-[160px]">Top ancestry</TableHead>
                    {focusCenter !== 'all' && <TableHead className="text-right">{focusCenter}</TableHead>}
                    {focusAncestry !== 'all' && (
                      <TableHead className="text-right">{focusAncestry}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTraits.map(trait => {
                    const isActive = trait.trait === selectedTraitName;
                    const focusCenterValue =
                      focusCenter === 'all' ? null : getCenterValue(trait, focusCenter);
                    const focusAncestryValue =
                      focusAncestry === 'all' ? null : getAncestryValue(trait, focusAncestry);

                    return (
                      <TableRow
                        key={trait.trait}
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-orange-50/80' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedTraitName(trait.trait)}
                      >
                        <TableCell className="font-medium text-gray-900">{trait.trait}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={performanceColors(trait.stats.center_average)}>
                            {formatValue(trait.stats.center_average)}
                        </Badge>
                      </TableCell>
                        <TableCell className="text-gray-700">
                          {trait.derived.bestCenter
                            ? `${trait.derived.bestCenter.name} (${formatValue(
                                trait.derived.bestCenter.value
                              )})`
                            : '—'}
                      </TableCell>
                        <TableCell className="text-gray-700">
                          {trait.derived.bestAncestry
                            ? `${trait.derived.bestAncestry.name} (${formatValue(
                                trait.derived.bestAncestry.value
                              )})`
                            : '—'}
                      </TableCell>
                        {focusCenter !== 'all' && (
                          <TableCell className="text-right">
                            <Badge className={performanceColors(focusCenterValue)}>
                              {formatValue(focusCenterValue)}
                        </Badge>
                      </TableCell>
                        )}
                        {focusAncestry !== 'all' && (
                          <TableCell className="text-right">
                            <Badge className={performanceColors(focusAncestryValue)}>
                              {formatValue(focusAncestryValue)}
                          </Badge>
                        </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {!paginatedTraits.length && (
                    <TableRow>
                      <TableCell colSpan={focusCenter === 'all' ? 5 : 6} className="py-6 text-center">
                        No traits match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-500 border-t">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                  <button
                  onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  className="px-3 py-1 rounded border text-gray-600 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                  onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded border text-gray-600 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm border">
            <CardHeader className="pb-2 flex flex-col gap-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                {activeTrait ? `Trait detail · ${activeTrait.trait}` : 'Trait detail'}
                  </CardTitle>
              {activeTrait && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium text-gray-700">Center average:</span>{' '}
                    <span>{formatValue(activeTrait.stats.center_average)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Best center:</span>{' '}
                    <span>
                      {activeTrait.derived.bestCenter
                        ? `${activeTrait.derived.bestCenter.name} (${formatValue(
                            activeTrait.derived.bestCenter.value
                          )})`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Ancestry average:</span>{' '}
                    <span>{formatValue(activeTrait.stats.ancestry_average)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Best ancestry:</span>{' '}
                    <span>
                      {activeTrait.derived.bestAncestry
                        ? `${activeTrait.derived.bestAncestry.name} (${formatValue(
                            activeTrait.derived.bestAncestry.value
                          )})`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              )}
                </CardHeader>
            <CardContent className="space-y-6">
              {activeTrait ? (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Center breakdown</h4>
                    <div className="overflow-y-auto max-h-72 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-2/3">Center</TableHead>
                    <TableHead className="text-right">Pearson&apos;s r</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeTrait.centers
                            .slice()
                            .sort((a, b) => {
                              const aVal = a.performance ?? -Infinity;
                              const bVal = b.performance ?? -Infinity;
                              return bVal - aVal;
                            })
                            .map(center => {
                              const value = center.performance;
                              const isFocused = focusCenter !== 'all' && center.center === focusCenter;
                              return (
                                <TableRow
                                  key={center.center}
                                  className={isFocused ? 'bg-orange-50/80' : undefined}
                                >
                                  <TableCell className="text-sm text-gray-700">
                                    {center.center}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge className={performanceColors(value)}>
                                      {formatValue(value)}
                      </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Ancestry breakdown</h4>
                    <div className="overflow-y-auto max-h-60 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ancestry group</TableHead>
                            <TableHead className="text-right">Pearson&apos;s r</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeTrait.ancestries
                            .slice()
                            .sort((a, b) => {
                              const aVal = a.performance ?? -Infinity;
                              const bVal = b.performance ?? -Infinity;
                              return bVal - aVal;
                            })
                            .map(group => {
                              const value = group.performance;
                              const isFocused =
                                focusAncestry !== 'all' && group.group === focusAncestry;
                              return (
                                <TableRow
                                  key={group.group}
                                  className={isFocused ? 'bg-sky-50/70' : undefined}
                                >
                                  <TableCell className="text-sm text-gray-700">
                                    {group.group}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge className={performanceColors(value)}>
                                      {formatValue(value)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>
                          </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Select a trait from the table to inspect center and ancestry performance details.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Crosshair className="h-5 w-5 text-indigo-600" />
                Summaries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm text-gray-700">
              {focusCenter === 'all' && focusAncestry === 'all' ? (
                <p className="text-gray-500">
                  Select a center or ancestry above to compute quick summaries across the current trait filter.
                </p>
              ) : (
                <>
                  {focusCenter !== 'all' && (
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-800">Center: {focusCenter}</p>
                      {focusCenterSummary ? (
                        <ul className="space-y-1 text-gray-600">
                          <li>
                            Traits with data: <strong>{focusCenterSummary.count}</strong>
                          </li>
                          <li>
                            Mean correlation:{' '}
                            <strong>{formatValue(focusCenterSummary.mean)}</strong>
                          </li>
                          <li>
                            Median correlation:{' '}
                            <strong>{formatValue(focusCenterSummary.median)}</strong>
                          </li>
                          <li>
                            Top trait:{' '}
                            <strong>
                              {focusCenterSummary.top.trait} ({formatValue(focusCenterSummary.top.value)})
                            </strong>
                          </li>
                          <li>
                            Lowest trait:{' '}
                            <strong>
                              {focusCenterSummary.bottom.trait} ({formatValue(focusCenterSummary.bottom.value)})
                            </strong>
                          </li>
                          <li>
                            Traits ≥ 0.40:{' '}
                            <strong>{focusCenterSummary.highCount}</strong>
                          </li>
                        </ul>
                      ) : (
                        <p className="text-gray-500">
                          No traits with valid values for this center under the current filters.
                        </p>
                      )}
                      </div>
                  )}

                  {focusAncestry !== 'all' && (
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-800">Ancestry: {focusAncestry}</p>
                      {focusAncestrySummary ? (
                        <ul className="space-y-1 text-gray-600">
                          <li>
                            Traits with data: <strong>{focusAncestrySummary.count}</strong>
                          </li>
                          <li>
                            Mean correlation:{' '}
                            <strong>{formatValue(focusAncestrySummary.mean)}</strong>
                          </li>
                          <li>
                            Median correlation:{' '}
                            <strong>{formatValue(focusAncestrySummary.median)}</strong>
                          </li>
                          <li>
                            Top trait:{' '}
                            <strong>
                              {focusAncestrySummary.top.trait} ({formatValue(focusAncestrySummary.top.value)})
                            </strong>
                          </li>
                          <li>
                            Lowest trait:{' '}
                            <strong>
                              {focusAncestrySummary.bottom.trait} ({formatValue(focusAncestrySummary.bottom.value)})
                            </strong>
                          </li>
                          <li>
                            Traits ≥ 0.40:{' '}
                            <strong>{focusAncestrySummary.highCount}</strong>
                          </li>
                        </ul>
                      ) : (
                        <p className="text-gray-500">
                          No traits with valid values for this ancestry under the current filters.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
                </CardContent>
              </Card>
        </div>
          </div>
    </div>
  );
};

export default ModelAssessmentPage;

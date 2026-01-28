import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Filter,
  Info,
  Search,
  Table as TableIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';

import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';

// New data structure interfaces
interface TraitData {
  metabolomic_trait: string;
  trait_index: number | null;
  lead_variants: string[];
  regions: string[];
  loci_indices: number[];
  supporting_centers: number | null;
}

interface TraitGroupData {
  trait_group: string;
  traits: TraitData[];
}

interface GeneData {
  gene: string;
  trait_groups: TraitGroupData[];
}

interface CslDataset {
  title: string;
  description: string;
  statistics: {
    total_rows: number;
    unique_genes: number;
    unique_loci_indices: number;
    unique_lead_variants: number;
    stable_variant_trait_pairs: number;
  };
  data: GeneData[];
}

type SortKey = 'gene' | 'traitGroupCount' | 'totalTraits';

const numericKeys = new Set<SortKey>(['traitGroupCount', 'totalTraits']);

const CSLIdentifiedLociPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [dataset, setDataset] = useState<CslDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [geneFilter, setGeneFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('gene');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedGenes, setExpandedGenes] = useState<Set<string>>(new Set());
  const [selectedTraitGroup, setSelectedTraitGroup] = useState<{
    gene: string;
    traitGroup: TraitGroupData;
  } | null>(null);

  // Auto-fill from query param ?q=
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  // If query looks like a region (e.g., 17q24.2), map it to its gene and auto-filter by gene
  useEffect(() => {
    const rawQuery = searchParams.get('q')?.trim();
    if (!rawQuery || !dataset?.data) return;
    const normalized = rawQuery.toLowerCase();
    const looksRegion = /\d/.test(normalized) && (normalized.includes('q') || normalized.includes('p'));
    if (!looksRegion) return;

    const regionMatch = dataset.data.find((geneData) =>
      geneData.trait_groups?.some((group) =>
        group.traits?.some((trait) =>
          trait.regions?.some((region: string) => region?.toLowerCase().includes(normalized))
        )
      )
    );

    if (regionMatch?.gene) {
      setGeneFilter(regionMatch.gene);
      setSearchTerm('');
    }
  }, [searchParams, dataset]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.BASE_URL}data/csl_loci_2026.json`);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json: CslDataset = await response.json();
        setDataset(json);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Unable to load CSL loci dataset. Please refresh the page.');
        toast.error('Failed to load CSL loci data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Flatten data for filtering and statistics
  const allTraitGroups = useMemo(() => {
    if (!dataset?.data) return [];
    const groups = new Set<string>();
    dataset.data.forEach(geneData => {
      geneData.trait_groups.forEach(group => {
        groups.add(group.trait_group);
      });
    });
    return Array.from(groups).sort();
  }, [dataset]);

  const allGenes = useMemo(() => {
    if (!dataset?.data) return [];
    return dataset.data.map(g => g.gene).sort();
  }, [dataset]);

  const filteredGenes = useMemo(() => {
    if (!dataset?.data) return [];
    const term = searchTerm.trim().toLowerCase();
    return dataset.data.filter(geneData => {
      if (geneFilter !== 'all' && geneData.gene !== geneFilter) return false;
      
      // Check if any trait group matches group filter
      if (groupFilter !== 'all') {
        const hasMatchingGroup = geneData.trait_groups.some(
          group => group.trait_group === groupFilter
        );
        if (!hasMatchingGroup) return false;
      }
      
      if (term) {
        const geneMatch = geneData.gene.toLowerCase().includes(term);
        const groupMatch = geneData.trait_groups.some(g =>
          g.trait_group.toLowerCase().includes(term)
        );
        const traitMatch = geneData.trait_groups.some(g =>
          g.traits.some(t => t.metabolomic_trait.toLowerCase().includes(term))
        );
        if (!geneMatch && !groupMatch && !traitMatch) return false;
      }
      
      return true;
    });
  }, [dataset, geneFilter, groupFilter, searchTerm]);

  const sortedGenes = useMemo(() => {
    const items = [...filteredGenes];
    items.sort((a, b) => {
      const factor = sortDirection === 'asc' ? 1 : -1;
      
      if (sortKey === 'gene') {
        return a.gene.localeCompare(b.gene) * factor;
      }
      
      if (sortKey === 'traitGroupCount') {
        const countA = a.trait_groups.length;
        const countB = b.trait_groups.length;
        return (countA - countB) * factor;
      }
      
      if (sortKey === 'totalTraits') {
        const countA = a.trait_groups.reduce((sum, g) => sum + g.traits.length, 0);
        const countB = b.trait_groups.reduce((sum, g) => sum + g.traits.length, 0);
        return (countA - countB) * factor;
      }
      
      return 0;
    });
    return items;
  }, [filteredGenes, sortKey, sortDirection]);

  const summary = useMemo(() => {
    if (!dataset) {
      return {
        totalPairs: 0,
        uniqueGeneCount: 0,
        uniqueTraitCount: 0,
        leadVariantCount: 0
      };
    }
    
    // Use statistics from dataset if available
    if (dataset.statistics) {
      const allTraits = new Set<string>();
      const allVariants = new Set<string>();
      
      dataset.data.forEach(geneData => {
        geneData.trait_groups.forEach(group => {
          group.traits.forEach(trait => {
            allTraits.add(trait.metabolomic_trait);
            trait.lead_variants.forEach(v => allVariants.add(v));
          });
        });
      });
      
      return {
        totalPairs: dataset.statistics.stable_variant_trait_pairs,
        uniqueGeneCount: dataset.statistics.unique_genes,
        uniqueTraitCount: allTraits.size,
        leadVariantCount: dataset.statistics.unique_lead_variants
      };
    }
    
    return {
      totalPairs: 0,
      uniqueGeneCount: 0,
      uniqueTraitCount: 0,
      leadVariantCount: 0
    };
  }, [dataset]);

  const groupChartData = useMemo(() => {
    if (!dataset?.data) return [];
    const counts = new Map<string, number>();
    
    filteredGenes.forEach(geneData => {
      geneData.trait_groups.forEach(group => {
        const current = counts.get(group.trait_group) ?? 0;
        counts.set(group.trait_group, current + group.traits.length);
      });
    });
    
    return Array.from(counts.entries())
      .map(([traitGroup, count]) => ({ traitGroup, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [filteredGenes]);

  const toggleGene = (gene: string) => {
    setExpandedGenes(prev => {
      const next = new Set(prev);
      if (next.has(gene)) {
        next.delete(gene);
      } else {
        next.add(gene);
      }
      return next;
    });
  };

  const handleTraitGroupClick = (gene: string, traitGroup: TraitGroupData) => {
    setSelectedTraitGroup({ gene, traitGroup });
  };

  const requestSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-orange-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-orange-600" />
    );
  };

  // Color palette for trait groups
  const traitGroupColors = [
    { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', badge: 'bg-green-100 text-green-800 border-green-200' },
    { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
    { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
    { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', badge: 'bg-pink-100 text-pink-800 border-pink-200' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
  ];

  // Get color for a trait group based on its name
  const getTraitGroupColor = (traitGroupName: string): typeof traitGroupColors[0] => {
    // Create a simple hash from the trait group name
    let hash = 0;
    for (let i = 0; i < traitGroupName.length; i++) {
      hash = traitGroupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % traitGroupColors.length;
    return traitGroupColors[index];
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto" />
          <p className="text-slate-600">Loading CSL locus catalogue…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card className="border border-rose-200 bg-rose-50">
          <CardHeader className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <CardTitle className="text-base text-rose-700">Data unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-rose-600 space-y-3">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1350px] mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <TableIcon className="w-8 h-8 text-orange-600" />
          <span>{dataset?.title ?? 'CSL identified loci'}</span>
        </h1>
        <p className="text-slate-600 max-w-3xl">{dataset?.description}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Stable variant–trait pairs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {summary.totalPairs.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">Unique mapped gene loci</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {summary.uniqueGeneCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Unique metabolomic traits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {summary.uniqueTraitCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">Lead variants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900">
              {summary.leadVariantCount.toLocaleString()}
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
                placeholder="Search gene, trait, or group…"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={groupFilter} onValueChange={value => setGroupFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All trait groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trait groups</SelectItem>
                {allTraitGroups.map(group => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={geneFilter} onValueChange={value => setGeneFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All genes" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All genes</SelectItem>
                {allGenes.map(gene => (
                  <SelectItem key={gene} value={gene}>
                    {gene}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">
        Stable variant–metabolomic trait pairs retained by CSL across assessment centers. Click on
        a trait group to unfold detailed traits and lead variants.
      </div>

      {groupChartData.length > 0 && (
        <Card className="shadow-sm border">
          <CardHeader className="pb-2 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-sm font-semibold text-slate-700">
              Leading metabolomic trait groups for the stable variant-trait pairs
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={groupChartData}
                layout="vertical"
                margin={{ top: 16, right: 32, bottom: 16, left: 140 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="traitGroup" type="category" tick={{ fontSize: 12 }} width={140} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(15, 23, 42, 0.05)' }}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border">
        <CardHeader className="pb-2 flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-600" />
            Putative causal gene loci identified by the CSL framework
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 min-w-[200px]">
                    <button
                      className="flex items-center gap-2 hover:text-orange-600"
                      onClick={() => requestSort('gene')}
                    >
                      Gene {getSortIcon('gene')}
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 min-w-[200px]">
                    <button
                      className="flex items-center gap-2 hover:text-orange-600"
                      onClick={() => requestSort('traitGroupCount')}
                    >
                      Trait Groups {getSortIcon('traitGroupCount')}
                    </button>
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 min-w-[150px]">
                    <button
                      className="flex items-center gap-2 hover:text-orange-600"
                      onClick={() => requestSort('totalTraits')}
                    >
                      Total Traits {getSortIcon('totalTraits')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGenes.map(geneData => {
                  const isExpanded = expandedGenes.has(geneData.gene);
                  const totalTraits = geneData.trait_groups.reduce(
                    (sum, g) => sum + g.traits.length,
                    0
                  );
                  
                  return (
                    <React.Fragment key={geneData.gene}>
                      <tr className="border-b hover:bg-slate-50 transition">
                        <td className="p-3">
                          <button
                            className="flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-orange-600"
                            onClick={() => toggleGene(geneData.gene)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            {geneData.gene}
                          </button>
                        </td>
                        <td className="p-3 text-sm text-slate-700">
                          {geneData.trait_groups.length}
                        </td>
                        <td className="p-3 text-sm text-slate-700">{totalTraits}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={3} className="p-0 bg-slate-50">
                            <div className="p-4 space-y-3">
                              {geneData.trait_groups.map((group, idx) => {
                                const colorScheme = getTraitGroupColor(group.trait_group);
                                return (
                                  <div
                                    key={idx}
                                    className={`border ${colorScheme.border} ${colorScheme.bg} rounded-lg p-3 transition hover:shadow-sm`}
                                  >
                                    <button
                                      className="w-full text-left"
                                      onClick={() => handleTraitGroupClick(geneData.gene, group)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <Badge className={`${colorScheme.badge} text-sm font-medium`}>
                                          {group.trait_group}
                                        </Badge>
                                        <span className={`text-xs ${colorScheme.text} font-medium`}>
                                          {group.traits.length} trait{group.traits.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {!sortedGenes.length && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-500">
                      No genes match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for trait group details */}
      <Dialog
        open={selectedTraitGroup !== null}
        onOpenChange={open => {
          if (!open) setSelectedTraitGroup(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTraitGroup?.gene} - {selectedTraitGroup?.traitGroup.trait_group}
            </DialogTitle>
            <DialogDescription>
              Detailed traits and lead variants for this trait group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedTraitGroup?.traitGroup.traits.map((trait, idx) => (
              <Card key={idx} className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{trait.metabolomic_trait}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-slate-700">Lead variants:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {trait.lead_variants.length > 0 ? (
                          trait.lead_variants.map((variant, vIdx) => (
                            <Badge
                              key={vIdx}
                              className="bg-blue-100 text-blue-800 border border-blue-200"
                            >
                              {variant}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Regions:</span>
                      <div className="mt-1">
                        {trait.regions.length > 0 ? (
                          <span className="text-slate-600">{trait.regions.join(', ')}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Loci indices:</span>
                      <div className="mt-1">
                        {trait.loci_indices.length > 0 ? (
                          <span className="text-slate-600">
                            {trait.loci_indices.join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Number of supporting assessment centers:</span>
                      <div className="mt-1">
                        {trait.supporting_centers !== null ? (
                          <span className="text-slate-600">{trait.supporting_centers}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CSLIdentifiedLociPage;

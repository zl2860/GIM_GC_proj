import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Activity, Target, Globe } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import toast from 'react-hot-toast';

interface RegulatoryEffectData {
  biomarker: string;
  variant: string;
  csl_feature_id: string;
  harmony_grade: string;
  cytoband: string;
  gene_symbol: string;
  // Ancestry-specific effects
  effect_europeans?: number | null;
  effect_finns?: number | null;
  effect_nonfinnish_europeans?: number | null;
  effect_south_asians?: number | null;
  effect_east_asians?: number | null;
  effect_africans?: number | null;
}

interface RegulatoryEffectDataset {
  title: string;
  description: string;
  columns: string[];
  data: RegulatoryEffectData[];
}

type SortField = keyof RegulatoryEffectData;
type SortDirection = 'asc' | 'desc' | null;

const ancestryGroups = [
  { key: 'effect_europeans', label: 'Europeans', color: 'bg-blue-100 text-blue-800' },
  { key: 'effect_finns', label: 'Finns', color: 'bg-green-100 text-green-800' },
  { key: 'effect_nonfinnish_europeans', label: 'Non-Finnish Europeans', color: 'bg-purple-100 text-purple-800' },
  { key: 'effect_south_asians', label: 'South Asians', color: 'bg-orange-100 text-orange-800' },
  { key: 'effect_east_asians', label: 'East Asians', color: 'bg-red-100 text-red-800' },
  { key: 'effect_africans', label: 'Africans', color: 'bg-yellow-100 text-yellow-800' }
];

const RegulatoryEffectsPageEnhanced: React.FC = () => {
  const [data, setData] = useState<RegulatoryEffectDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBiomarker, setSelectedBiomarker] = useState('all');
  const [selectedGene, setSelectedGene] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedAncestry, setSelectedAncestry] = useState('all');
  const [sortField, setSortField] = useState<SortField>('harmony_grade');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedEffect, setSelectedEffect] = useState<RegulatoryEffectData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('table');
  const itemsPerPage = 30;

  useEffect(() => {
    const loadData = async () => {
      try {
        // 1) fetch both in parallel
        const [basicRes, ancestryRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/regulatory_effects.json`),
          fetch(`${import.meta.env.BASE_URL}data/ancestry_reg_effects.json`),
        ]);
  
        // 2) guard status codes
        if (!basicRes.ok || !ancestryRes.ok) {
          throw new Error(`Fetch failed: basic(${basicRes.status}), ancestry(${ancestryRes.status})`);
        }
  
        // 3) read as text
        const [basicText, ancestryText] = await Promise.all([
          basicRes.text(),
          ancestryRes.text(),
        ]);
  
        // 4) sanitize NaNs → nulls
        const basicClean   = basicText.replace(/\bNaN\b/g, 'null');
        const ancestryClean = ancestryText.replace(/\bNaN\b/g, 'null');
  
        // 5) parse
        const basicData   = JSON.parse(basicClean) as any;
        const ancestryRaw = JSON.parse(ancestryClean) as any;
  
        console.log('basicData →', basicData);
        console.log('ancestryRaw →', ancestryRaw);
  
        // 6) drill into the sheet rows
        const rawRows: any[] = ancestryRaw.sheets?.Sheet1?.data ?? [];
  
        // 7) map
        const processedAncestryData = rawRows
          .map((item: any) => ({
            biomarker: item["Supplementary table 10. Multi-ancestry gene loci regulatory effects on traits in the GIMs of GC and gastric lesion progression"],
            variant:   item["Unnamed: 1"],
            csl_feature_id: String(item["Unnamed: 2"] || ''),
            harmony_grade:  String(item["Unnamed: 3"] || ''),
            cytoband:       item["Unnamed: 4"],
            gene_symbol:    item["Unnamed: 5"],
            effect_europeans:               item["Unnamed: 16"],
            effect_finns:                   item["Unnamed: 17"],
            effect_nonfinnish_europeans:    item["Unnamed: 18"],
            effect_south_asians:            item["Unnamed: 19"],
            effect_east_asians:             item["Unnamed: 20"],
            effect_africans:                item["Unnamed: 21"],
          }))
          .filter((row: any) => row.biomarker && row.variant);
  
        // 8) merge with basic
        const merged: RegulatoryEffectDataset = {
          ...basicData,
          title: basicData.title || "Multi-ancestry Gene Loci Regulatory Effects",
          description: basicData.description || "…",
          data: processedAncestryData,
        };
  
        setData(merged);
      } catch (err) {
        console.error('Error loading regulatory effects data:', err);
        toast.error('Failed to load regulatory effects data');
      } finally {
        setLoading(false);
      }
    };
  
    loadData();
  }, []);

  const uniqueBiomarkers = useMemo(() => {
    if (!data) return [];
    const biomarkers = [...new Set(data.data.map(item => item.biomarker))]
      .filter(biomarker => biomarker && biomarker.trim() !== '')
      .sort();
    return biomarkers;
  }, [data]);

  const uniqueGenes = useMemo(() => {
    if (!data) return [];
    const genes = [...new Set(data.data.map(item => item.gene_symbol))]
      .filter(gene => gene && gene.trim() !== '' && gene !== 'Gastric cancer')
      .sort();
    return genes;
  }, [data]);

  const uniqueGrades = useMemo(() => {
    if (!data) return [];
    const grades = [...new Set(data.data.map(item => item.harmony_grade))]
      .filter(grade => grade && grade.trim() !== '')
      .sort();
    return grades;
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.data.filter(item => {
      const matchesSearch = !searchTerm || 
        (item.biomarker && item.biomarker.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.variant && item.variant.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.gene_symbol && item.gene_symbol.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.cytoband && item.cytoband.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesBiomarker = selectedBiomarker === 'all' || item.biomarker === selectedBiomarker;
      const matchesGene = selectedGene === 'all' || item.gene_symbol === selectedGene;
      const matchesGrade = selectedGrade === 'all' || item.harmony_grade === selectedGrade;
      
      // Ancestry filter
      const matchesAncestry = selectedAncestry === 'all' || (() => {
        const ancestryKey = `effect_${selectedAncestry}` as keyof RegulatoryEffectData;
        return item[ancestryKey] !== null && item[ancestryKey] !== undefined;
      })();

      return matchesSearch && matchesBiomarker && matchesGene && matchesGrade && matchesAncestry;
    });

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        let comparison = 0;
        if (sortField === 'harmony_grade') {
          comparison = parseInt(String(aVal)) - parseInt(String(bVal));
        } else if (sortField.toString().startsWith('effect_')) {
          const aNum = Number(aVal) || 0;
          const bNum = Number(bVal) || 0;
          comparison = aNum - bNum;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, selectedBiomarker, selectedGene, selectedGrade, selectedAncestry, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => 
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortField('harmony_grade');
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-4 h-4 text-blue-600" />;
    if (sortDirection === 'desc') return <ArrowDown className="w-4 h-4 text-blue-600" />;
    return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
  };

  const getGradeBadgeColor = (grade: string) => {
    const gradeNum = parseInt(grade);
    if (gradeNum >= 5) return 'bg-red-100 text-red-800 border-red-200';
    if (gradeNum >= 4) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (gradeNum >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (gradeNum >= 2) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getGradeLabel = (grade: string) => {
    const gradeNum = parseInt(grade);
    if (gradeNum >= 5) return 'Very High';
    if (gradeNum >= 4) return 'High';
    if (gradeNum >= 3) return 'Medium';
    if (gradeNum >= 2) return 'Low';
    return 'Very Low';
  };

  const getEffectColor = (
    effect: number | string | null | undefined
  ): string => {
    const num = typeof effect === 'number'
      ? effect
      : parseFloat(effect as string);
    if (isNaN(num)) return 'bg-gray-100 text-gray-500';
    if (num > 0.1)     return 'bg-red-100 text-red-800';
    if (num > 0)       return 'bg-orange-100 text-orange-800';
    if (num < -0.1)    return 'bg-blue-100 text-blue-800';
    if (num < 0)       return 'bg-cyan-100 text-cyan-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatEffect = (
    effect: number | string | null | undefined
  ): string => {
    if (effect === null || effect === undefined) return 'N/A';
    const num = typeof effect === 'number'
      ? effect
      : parseFloat(effect as string);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(4);
  };

  const exportData = () => {
    if (!data) return;
    
    const exportData = {
      title: data.title,
      description: data.description,
      filtered_data: filteredAndSortedData,
      filters: {
        search: searchTerm,
        biomarker: selectedBiomarker,
        gene: selectedGene,
        grade: selectedGrade,
        ancestry: selectedAncestry,
        sort: { field: sortField, direction: sortDirection }
      },
      total_records: filteredAndSortedData.length,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regulatory-effects-enhanced.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Enhanced regulatory effects data exported successfully!');
  };

  const exportCSV = () => {
    if (!data) return;
    
    const headers = [
      'Biomarker', 'Variant', 'CSL Feature ID', 'Harmony Grade', 'Cytoband', 'Gene Symbol',
      'Effect Europeans', 'Effect Finns', 'Effect Non-Finnish Europeans',
      'Effect South Asians', 'Effect East Asians', 'Effect Africans'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(row => [
        `"${row.biomarker}"`,
        `"${row.variant}"`,
        `"${row.csl_feature_id}"`,
        `"${row.harmony_grade}"`,
        `"${row.cytoband}"`,
        `"${row.gene_symbol}"`,
        `"${formatEffect(row.effect_europeans)}"`,
        `"${formatEffect(row.effect_finns)}"`,
        `"${formatEffect(row.effect_nonfinnish_europeans)}"`,
        `"${formatEffect(row.effect_south_asians)}"`,
        `"${formatEffect(row.effect_east_asians)}"`,
        `"${formatEffect(row.effect_africans)}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'regulatory-effects-enhanced.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Enhanced regulatory effects data exported as CSV!');
  };

  const getAncestryStats = () => {
    if (!filteredAndSortedData.length) return {};
    
    return ancestryGroups.reduce((stats, ancestry) => {
      const validEffects = filteredAndSortedData
        .map(item => item[ancestry.key as keyof RegulatoryEffectData] as number)
        .filter(effect => effect !== null && effect !== undefined && !isNaN(effect));
      
      stats[ancestry.key] = {
        count: validEffects.length,
        mean: validEffects.length > 0 ? validEffects.reduce((a, b) => a + b, 0) / validEffects.length : 0,
        positive: validEffects.filter(e => e > 0).length,
        negative: validEffects.filter(e => e < 0).length
      };
      
      return stats;
    }, {} as any);
  };

  const ancestryStats = getAncestryStats();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enhanced regulatory effects data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load regulatory effects data. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
              <Globe className="w-8 h-8 text-orange-600" />
              <span>Multi-ancestry Regulatory Effects</span>
            </h1>
            <p className="text-gray-600">
              Gene loci regulatory effects on traits in the GIMs with cross-ancestry effect estimates
            </p>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span>{filteredAndSortedData.length} regulatory effects</span>
              <span>•</span>
              <span>{uniqueBiomarkers.length} metabolic traits</span>
              <span>•</span>
              <span>{uniqueGenes.length} genes</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportCSV}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportData}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filters & Search</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search biomarker, variant, gene..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metabolic Trait</label>
              <Select value={selectedBiomarker} onValueChange={(value) => {
                setSelectedBiomarker(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All traits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Traits ({uniqueBiomarkers.length})</SelectItem>
                  {uniqueBiomarkers.map(biomarker => (
                    <SelectItem key={biomarker} value={biomarker}>
                      {biomarker.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
              <Select value={selectedGene} onValueChange={(value) => {
                setSelectedGene(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All genes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Gastric cancer</SelectItem>
                  {uniqueGenes.map(gene => (
                    <SelectItem key={gene} value={gene}>
                      {gene}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Harmony Grade</label>
              <Select value={selectedGrade} onValueChange={(value) => {
                setSelectedGrade(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {uniqueGrades.map(grade => (
                    <SelectItem key={grade} value={grade}>
                      Grade {grade} - {getGradeLabel(grade)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ancestry Group</label>
              <Select value={selectedAncestry} onValueChange={(value) => {
                setSelectedAncestry(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All ancestries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ancestries</SelectItem>
                  {ancestryGroups.map(ancestry => (
                    <SelectItem key={ancestry.key.replace('effect_', '')} value={ancestry.key.replace('effect_', '')}>
                      {ancestry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'table' | 'stats')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="table">Data Table</TabsTrigger>
          <TabsTrigger value="stats">Ancestry Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {ancestryGroups.map(ancestry => {
              const stats = ancestryStats[ancestry.key];
              if (!stats) return null;
              
              return (
                <Card key={ancestry.key}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${ancestry.color.split(' ')[0]}`}></div>
                      <span>{ancestry.label}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Valid Effects:</span>
                        <span className="font-semibold">{stats.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Mean Effect:</span>
                        <span className="font-semibold">{stats.mean.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Positive:</span>
                        <span className="font-semibold text-red-600">{stats.positive}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Negative:</span>
                        <span className="font-semibold text-blue-600">{stats.negative}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="table">
          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('biomarker')}>
                      <div className="flex items-center space-x-1">
                        <span>Metabolic Trait</span>
                        {getSortIcon('biomarker')}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('variant')}>
                      <div className="flex items-center space-x-1">
                        <span>Variant</span>
                        {getSortIcon('variant')}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('gene_symbol')}>
                      <div className="flex items-center space-x-1">
                        <span>Gene</span>
                        {getSortIcon('gene_symbol')}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('harmony_grade')}>
                      <div className="flex items-center space-x-1">
                        <span>Grade</span>
                        {getSortIcon('harmony_grade')}
                      </div>
                    </TableHead>
                    {ancestryGroups.map(ancestry => (
                      <TableHead key={ancestry.key} className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 text-center" onClick={() => handleSort(ancestry.key as SortField)}>
                        <div className="flex items-center justify-center space-x-1">
                          <span className="text-xs">{ancestry.label.replace(' ', '\n')}</span>
                          {getSortIcon(ancestry.key as SortField)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((effect, index) => (
                    <TableRow
                      key={`${effect.variant}-${index}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedEffect(effect)}
                    >
                      <TableCell className="font-medium text-indigo-700">
                        {effect.biomarker?.replace(/_/g, ' ') || ''}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {effect.variant}
                      </TableCell>
                      <TableCell>
                        {effect.gene_symbol}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getGradeBadgeColor(effect.harmony_grade)} border`}>
                          {effect.harmony_grade} - {getGradeLabel(effect.harmony_grade)}
                        </Badge>
                      </TableCell>
                      {ancestryGroups.map(ancestry => (
                        <TableCell key={ancestry.key} className="text-center">
                          <Badge className={`${getEffectColor(effect[ancestry.key as keyof RegulatoryEffectData] as number)} border text-xs font-mono`}>
                            {formatEffect(effect[ancestry.key as keyof RegulatoryEffectData] as number)}
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {paginatedData.length} of {filteredAndSortedData.length} regulatory effects
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Panel */}
      {selectedEffect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Regulatory Effect Details</h3>
              <button
                onClick={() => setSelectedEffect(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Basic Information</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Metabolic Trait:</strong> {selectedEffect.biomarker?.replace(/_/g, ' ')}</div>
                  <div><strong>Variant:</strong> {selectedEffect.variant}</div>
                  <div><strong>Gene:</strong> {selectedEffect.gene_symbol}</div>
                  <div><strong>Cytoband:</strong> {selectedEffect.cytoband}</div>
                  <div><strong>Harmony Grade:</strong> {selectedEffect.harmony_grade} - {getGradeLabel(selectedEffect.harmony_grade)}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Ancestry-Specific Effects</h4>
                <div className="space-y-2 text-sm">
                  {ancestryGroups.map(ancestry => (
                    <div key={ancestry.key} className="flex justify-between">
                      <span>{ancestry.label}:</span>
                      <Badge className={`${getEffectColor(selectedEffect[ancestry.key as keyof RegulatoryEffectData] as number)} text-xs font-mono`}>
                        {formatEffect(selectedEffect[ancestry.key as keyof RegulatoryEffectData] as number)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulatoryEffectsPageEnhanced;

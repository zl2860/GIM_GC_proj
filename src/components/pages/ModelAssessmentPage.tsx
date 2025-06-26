import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, Filter, BarChart3, TrendingUp, Activity, Building } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import toast from 'react-hot-toast';

interface AssessmentData {
  metabolic_trait: string;
  center_performances: { [center: string]: number | null };
  average_performance: number;
  best_center: string;
  worst_center: string;
  performance_range: number;
}

interface CenterData {
  center_name: string;
  average_performance: number;
  trait_count: number;
  best_traits: string[];
  worst_traits: string[];
}

const assessmentCenters = [
  'Hounslow', 'Manchester', 'Stoke', 'Nottingham', 'Leeds', 'Oxford', 
  'Sheffield', 'Croydon', 'Barts', 'Cardiff', 'Middlesborough', 'Newcastle',
  'Swansea', 'Birmingham', 'Bury', 'Liverpool', 'Edinburgh', 'Reading', 
  'Bristol', 'Glasgow', 'Stockport'
];

const ModelAssessmentPageFixed: React.FC = () => {
  const [data, setData] = useState<AssessmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [minPerformance, setMinPerformance] = useState<number>(0);
  const [maxPerformance, setMaxPerformance] = useState<number>(1);
  
  // View states
  const [activeTab, setActiveTab] = useState<'overview' | 'traits' | 'centers'>('overview');
  const [sortBy, setSortBy] = useState<'trait' | 'average' | 'range'>('average');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${import.meta.env.BASE_URL}data/multi_center_assessment.json`);
        if (!response.ok) {
          throw new Error('Failed to load assessment data');
        }
        const jsonData = await response.json();
        
        // Process the complex spreadsheet data
        const rawData = jsonData.sheets?.Sheet1?.data || [];
        
        if (rawData.length === 0) {
          throw new Error('No data found in the assessment file');
        }

        // Find the header row (row with center names)
        const headerRowIndex = rawData.findIndex((row: any) => 
          row["Unnamed: 1"] === "Hounslow" || 
          (typeof row["Unnamed: 1"] === "string" && row["Unnamed: 1"].includes("Hounslow"))
        );

        if (headerRowIndex === -1) {
          throw new Error('Could not find assessment center headers in data');
        }

        // Extract center names from header row
        const headerRow = rawData[headerRowIndex];
        const centerNames = assessmentCenters; // Use predefined list for consistency

        // Process data rows (skip header and metadata rows)
        const processedData: AssessmentData[] = [];
        
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
          const row = rawData[i];
          const traitName = row["Supplementary table 6. Model performance by UKBB assessment centers and ethnic groups"];
          
          // Skip empty or invalid rows
          if (!traitName || typeof traitName !== 'string' || traitName.trim() === '') {
            continue;
          }

          // Extract performance values for each center
          const centerPerformances: { [center: string]: number | null } = {};
          const validPerformances: number[] = [];
          
          centerNames.forEach((centerName, index) => {
            const columnKey = `Unnamed: ${index + 1}`;
            const performance = row[columnKey];
            
            // Handle null, undefined, NaN values
            if (performance === null || performance === undefined || 
                performance === 'NaN' || isNaN(Number(performance))) {
              centerPerformances[centerName] = null;
            } else {
              const numPerformance = Number(performance);
              centerPerformances[centerName] = numPerformance;
              validPerformances.push(numPerformance);
            }
          });

          // Calculate statistics
          if (validPerformances.length > 0) {
            const avgPerformance = validPerformances.reduce((a, b) => a + b, 0) / validPerformances.length;
            const maxPerf = Math.max(...validPerformances);
            const minPerf = Math.min(...validPerformances);
            
            // Find best and worst performing centers
            const bestCenter = centerNames.find(center => 
              centerPerformances[center] === maxPerf
            ) || 'Unknown';
            
            const worstCenter = centerNames.find(center => 
              centerPerformances[center] === minPerf
            ) || 'Unknown';

            processedData.push({
              metabolic_trait: traitName,
              center_performances: centerPerformances,
              average_performance: avgPerformance,
              best_center: bestCenter,
              worst_center: worstCenter,
              performance_range: maxPerf - minPerf
            });
          }
        }

        if (processedData.length === 0) {
          throw new Error('No valid assessment data could be processed');
        }

        setData(processedData);
        setError(null);
      } catch (error) {
        console.error('Error loading assessment data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        toast.error('Failed to load assessment data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(item => {
      const matchesSearch = !searchTerm || 
        item.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.best_center.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.worst_center.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCenter = selectedCenter === 'all' || (() => {
        const centerPerf = item.center_performances[selectedCenter];
        return centerPerf !== null && centerPerf !== undefined;
      })();
      
      const matchesPerformance = item.average_performance >= minPerformance && 
                                item.average_performance <= maxPerformance;

      return matchesSearch && matchesCenter && matchesPerformance;
    });

    // Sort data
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'trait':
          comparison = a.metabolic_trait.localeCompare(b.metabolic_trait);
          break;
        case 'average':
          comparison = a.average_performance - b.average_performance;
          break;
        case 'range':
          comparison = a.performance_range - b.performance_range;
          break;
        default:
          comparison = a.average_performance - b.average_performance;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, searchTerm, selectedCenter, minPerformance, maxPerformance, sortBy, sortDirection]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  // Center analysis
  const centerAnalysis = useMemo(() => {
    const centerStats: { [center: string]: CenterData } = {};
    
    assessmentCenters.forEach(center => {
      const centerPerformances: number[] = [];
      const traitPerformances: { trait: string; performance: number }[] = [];
      
      data.forEach(item => {
        const performance = item.center_performances[center];
        if (performance !== null && performance !== undefined) {
          centerPerformances.push(performance);
          traitPerformances.push({
            trait: item.metabolic_trait,
            performance: performance
          });
        }
      });
      
      if (centerPerformances.length > 0) {
        const avgPerformance = centerPerformances.reduce((a, b) => a + b, 0) / centerPerformances.length;
        
        // Sort traits by performance for this center
        traitPerformances.sort((a, b) => b.performance - a.performance);
        
        centerStats[center] = {
          center_name: center,
          average_performance: avgPerformance,
          trait_count: centerPerformances.length,
          best_traits: traitPerformances.slice(0, 3).map(t => t.trait),
          worst_traits: traitPerformances.slice(-3).reverse().map(t => t.trait)
        };
      }
    });
    
    return Object.values(centerStats).sort((a, b) => b.average_performance - a.average_performance);
  }, [data]);

  const getPerformanceColor = (performance: number | null) => {
    if (performance === null || performance === undefined) return 'bg-gray-100 text-gray-500';
    if (performance >= 0.4) return 'bg-green-100 text-green-800';
    if (performance >= 0.35) return 'bg-yellow-100 text-yellow-800';
    if (performance >= 0.3) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const formatPerformance = (performance: number | null) => {
    if (performance === null || performance === undefined) return 'N/A';
    return performance.toFixed(3);
  };

  const exportData = () => {
    const exportData = {
      title: "UKBB CSL Model Assessment - Multi-Center Performance Analysis",
      filtered_data: filteredAndSortedData,
      center_analysis: centerAnalysis,
      filters: {
        search: searchTerm,
        center: selectedCenter,
        performance_range: { min: minPerformance, max: maxPerformance },
        sort: { field: sortBy, direction: sortDirection }
      },
      total_records: filteredAndSortedData.length,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model-assessment-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Model assessment data exported successfully!');
  };

  const exportCSV = () => {
    const headers = [
      'Metabolic Trait', 'Average Performance', 'Best Center', 'Worst Center', 'Performance Range',
      ...assessmentCenters
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(row => [
        `"${row.metabolic_trait}"`,
        row.average_performance.toFixed(3),
        `"${row.best_center}"`,
        `"${row.worst_center}"`,
        row.performance_range.toFixed(3),
        ...assessmentCenters.map(center => formatPerformance(row.center_performances[center]))
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model-assessment-analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Model assessment data exported as CSV!');
  };

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

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <Activity className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Data Loading Error</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
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
              <Building className="w-8 h-8 text-orange-600" />
              <span>UKBB CSL Model Assessment</span>
            </h1>
            <p className="text-gray-600">
              Multi-center and ethnic group assessment of UKBB CSL model prediction performance
            </p>
            <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
              <span>{filteredAndSortedData.length} metabolic traits</span>
              <span>•</span>
              <span>{assessmentCenters.length} assessment centers</span>
              <span>•</span>
              <span>Performance correlation analysis</span>
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
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search traits, centers..."
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Center</label>
              <Select value={selectedCenter} onValueChange={(value) => {
                setSelectedCenter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All centers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Centers ({assessmentCenters.length})</SelectItem>
                  {assessmentCenters.map(center => (
                    <SelectItem key={center} value={center}>
                      {center}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Performance</label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={minPerformance}
                onChange={(e) => {
                  setMinPerformance(Number(e.target.value));
                  setCurrentPage(1);
                }}
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Performance</label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={maxPerformance}
                onChange={(e) => {
                  setMaxPerformance(Number(e.target.value));
                  setCurrentPage(1);
                }}
                placeholder="1.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <Select value={sortBy} onValueChange={(value: any) => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="average">Average Performance</SelectItem>
                  <SelectItem value="trait">Metabolic Trait</SelectItem>
                  <SelectItem value="range">Performance Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'traits' | 'centers')} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="traits">Trait Performance</TabsTrigger>
          <TabsTrigger value="centers">Center Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Traits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{data.length}</div>
                <p className="text-sm text-gray-600">Metabolic traits assessed</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assessment Centers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{assessmentCenters.length}</div>
                <p className="text-sm text-gray-600">UKBB centers included</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Average Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {data.length > 0 ? (data.reduce((sum, item) => sum + item.average_performance, 0) / data.length).toFixed(3) : '0.000'}
                </div>
                <p className="text-sm text-gray-600">Mean correlation across all</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Best Performing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-purple-600">
                  {centerAnalysis.length > 0 ? centerAnalysis[0].center_name : 'N/A'}
                </div>
                <p className="text-sm text-gray-600">
                  {centerAnalysis.length > 0 ? centerAnalysis[0].average_performance.toFixed(3) : 'N/A'} avg performance
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="traits">
          {/* Trait Performance Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Metabolic Trait</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-center">Avg Performance</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-center">Best Center</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-center">Worst Center</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-center">Range</TableHead>
                    {assessmentCenters.slice(0, 21).map(center => (
                      <TableHead key={center} className="font-semibold text-gray-900 text-center text-xs">
                        {center}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item, index) => (
                    <TableRow key={`${item.metabolic_trait}-${index}`} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-indigo-700">
                        {item.metabolic_trait.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${getPerformanceColor(item.average_performance)} border font-mono text-xs`}>
                          {formatPerformance(item.average_performance)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium text-green-700">
                        {item.best_center}
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium text-red-700">
                        {item.worst_center}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-gray-100 text-gray-800 border font-mono text-xs">
                          {formatPerformance(item.performance_range)}
                        </Badge>
                      </TableCell>
                      {assessmentCenters.slice(0, 21).map(center => (
                        <TableCell key={center} className="text-center">
                          <Badge className={`${getPerformanceColor(item.center_performances[center])} border text-xs font-mono`}>
                            {formatPerformance(item.center_performances[center])}
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
                  Showing {paginatedData.length} of {filteredAndSortedData.length} traits
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

        <TabsContent value="centers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {centerAnalysis.map(center => (
              <Card key={center.center_name}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Building className="w-5 h-5 text-orange-600" />
                    <span>{center.center_name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Performance:</span>
                      <Badge className={`${getPerformanceColor(center.average_performance)} text-xs font-mono`}>
                        {formatPerformance(center.average_performance)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Traits Assessed:</span>
                      <span className="font-semibold">{center.trait_count}</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-gray-600 mb-1">Top Traits:</div>
                      <div className="space-y-1">
                        {center.best_traits.slice(0, 2).map(trait => (
                          <div key={trait} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                            {trait.replace(/_/g, ' ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ModelAssessmentPageFixed;

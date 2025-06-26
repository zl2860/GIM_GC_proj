import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Beaker, Info } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import toast from 'react-hot-toast';

interface MetabolicTraitData {
  biomarker: string;
  description: string;
  units: string;
  group: string;
  sub_group: string;
}

interface MetabolicTraitDataset {
  title: string;
  description: string;
  columns: string[];
  data: MetabolicTraitData[];
}

type SortField = keyof MetabolicTraitData;
type SortDirection = 'asc' | 'desc' | null;

const MetabolicTraitsPage: React.FC = () => {
  const [data, setData] = useState<MetabolicTraitDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedSubGroup, setSelectedSubGroup] = useState('all');
  const [sortField, setSortField] = useState<SortField>('biomarker');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTrait, setSelectedTrait] = useState<MetabolicTraitData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/biomarker_information.json`);
        const traitData = await response.json();
        setData(traitData);
      } catch (error) {
        console.error('Error loading metabolic trait data:', error);
        toast.error('Failed to load metabolic trait information');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const uniqueGroups = useMemo(() => {
    if (!data) return [];
    const groups = [...new Set(data.data.map(item => item.group))].sort();
    return groups.filter(group => group && group !== '-');
  }, [data]);

  const uniqueSubGroups = useMemo(() => {
    if (!data) return [];
    let subGroups = data.data
      .filter(item => selectedGroup === 'all' || item.group === selectedGroup)
      .map(item => item.sub_group)
      .filter(subGroup => subGroup && subGroup !== '-');
    return [...new Set(subGroups)].sort();
  }, [data, selectedGroup]);

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.data.filter(item => {
      const matchesSearch = !searchTerm || 
        (item.biomarker && item.biomarker.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.group && item.group.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.units && item.units.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGroup = selectedGroup === 'all' || item.group === selectedGroup;
      const matchesSubGroup = selectedSubGroup === 'all' || item.sub_group === selectedSubGroup;

      return matchesSearch && matchesGroup && matchesSubGroup;
    });

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, selectedGroup, selectedSubGroup, sortField, sortDirection]);

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
        setSortField('biomarker');
        setSortDirection('asc');
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

  const getGroupColor = (group: string) => {
    const colors: { [key: string]: string } = {
      'Cholesterol': 'bg-red-100 text-red-800',
      'Triglycerides': 'bg-blue-100 text-blue-800',
      'Fatty Acids': 'bg-green-100 text-green-800',
      'Amino Acids': 'bg-purple-100 text-purple-800',
      'Glycolysis Related': 'bg-yellow-100 text-yellow-800',
      'Ketone Bodies': 'bg-indigo-100 text-indigo-800',
      'Inflammation': 'bg-orange-100 text-orange-800',
      'Fluid Balance': 'bg-teal-100 text-teal-800'
    };
    return colors[group] || 'bg-gray-100 text-gray-800';
  };

  const exportData = () => {
    if (!data) return;
    
    const exportData = {
      title: data.title,
      description: data.description,
      filtered_data: filteredAndSortedData,
      filters: {
        search: searchTerm,
        group: selectedGroup,
        sub_group: selectedSubGroup,
        sort: { field: sortField, direction: sortDirection }
      },
      total_records: filteredAndSortedData.length,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metabolic-traits-information.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Metabolic traits information exported successfully!');
  };

  const exportCSV = () => {
    if (!data) return;
    
    const headers = ['Metabolic Trait', 'Description', 'Units', 'Group', 'Sub Group'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(row => [
        `"${row.biomarker}"`,
        `"${row.description}"`,
        `"${row.units}"`,
        `"${row.group}"`,
        `"${row.sub_group}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metabolic-traits-information.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Metabolic traits information exported as CSV!');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading metabolic trait information...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load metabolic trait information. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              NMR Blood Metabolic Traits Information
            </h1>
            <p className="text-gray-600">
              Comprehensive information about 249 nuclear magnetic resonance (NMR) blood metabolic traits 
              measured for UK Biobank participants in this study
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportCSV}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportData}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
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
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search metabolic traits, descriptions..."
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
              <Select value={selectedGroup} onValueChange={(value) => {
                setSelectedGroup(value);
                setSelectedSubGroup('all');
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups ({uniqueGroups.length})</SelectItem>
                  {uniqueGroups.map(group => (
                    <SelectItem key={group} value={group}>{group}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub Group</label>
              <Select value={selectedSubGroup} onValueChange={(value) => {
                setSelectedSubGroup(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub Groups ({uniqueSubGroups.length})</SelectItem>
                  {uniqueSubGroups.map(subGroup => (
                    <SelectItem key={subGroup} value={subGroup}>{subGroup}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <div>Showing {paginatedData.length} of {filteredAndSortedData.length} metabolic traits</div>
                <div className="flex space-x-2 mt-1">
                  {selectedGroup !== 'all' && (
                    <Badge variant="secondary">Group: {selectedGroup}</Badge>
                  )}
                  {selectedSubGroup !== 'all' && (
                    <Badge variant="secondary">Sub: {selectedSubGroup}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Data Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('biomarker')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Metabolic Trait</span>
                        {getSortIcon('biomarker')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('description')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Description</span>
                        {getSortIcon('description')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('units')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Units</span>
                        {getSortIcon('units')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('group')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Group</span>
                        {getSortIcon('group')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((biomarker, index) => (
                    <TableRow 
                      key={biomarker.biomarker}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedTrait(biomarker)}
                    >
                      <TableCell className="font-medium text-purple-700">
                        {biomarker.biomarker ? biomarker.biomarker.replace(/_/g, ' ') : ''}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={biomarker.description}>
                        {biomarker.description}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-600">
                        {biomarker.units}
                      </TableCell>
                      <TableCell>
                        <Badge className={getGroupColor(biomarker.group)}>
                          {biomarker.group}
                        </Badge>
                        {biomarker.sub_group && biomarker.sub_group !== '-' && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            {biomarker.sub_group}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} ({filteredAndSortedData.length} total metabolic traits)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      if (pageNum > totalPages) return null;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm border rounded ${
                            currentPage === pageNum
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
        <div className="space-y-6">
          {/* Selected Metabolic Trait Details */}
          {selectedTrait ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Metabolic Trait Details</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="font-medium text-gray-900 mb-1">
                    {selectedTrait.biomarker ? selectedTrait.biomarker.replace(/_/g, ' ') : ''}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedTrait.description}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Units</div>
                    <div className="font-mono text-sm text-gray-900">{selectedTrait.units}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Group</div>
                    <Badge className={getGroupColor(selectedTrait.group)}>
                      {selectedTrait.group}
                    </Badge>
                  </div>
                </div>
                
                {selectedTrait.sub_group && selectedTrait.sub_group !== '-' && (
                  <div>
                    <div className="text-sm font-medium text-gray-700">Sub Group</div>
                    <Badge variant="outline">{selectedTrait.sub_group}</Badge>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <Beaker className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Metabolic Trait</h3>
              <p className="text-gray-600 text-sm">
                Click on any row in the table to view detailed information about that metabolic trait.
              </p>
            </div>
          )}

          {/* Group Summary */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Summary</h3>
            <div className="space-y-3">
              {uniqueGroups.map(group => {
                const count = data.data.filter(item => item.group === group).length;
                return (
                  <div key={group} className="flex justify-between items-center">
                    <Badge className={getGroupColor(group)}>{group}</Badge>
                    <span className="text-sm text-gray-600">{count} traits</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Study Information */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Study Information</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div><strong>Total Metabolic Traits:</strong> {data.data.length}</div>
              <div><strong>Analysis Method:</strong> NMR Spectroscopy</div>
              <div><strong>Platform:</strong> Nightingale Health</div>
              <div><strong>Quality Control:</strong> Standardized protocols</div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">{filteredAndSortedData.length}</div>
          <div className="text-sm text-gray-600">Filtered Traits</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{uniqueGroups.length}</div>
          <div className="text-sm text-gray-600">Trait Groups</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{uniqueSubGroups.length}</div>
          <div className="text-sm text-gray-600">Sub Groups</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">
            {data.data.filter(item => item.group === 'Cholesterol').length}
          </div>
          <div className="text-sm text-gray-600">Cholesterol Traits</div>
        </div>
      </div>
    </div>
  );
};

export default MetabolicTraitsPage;

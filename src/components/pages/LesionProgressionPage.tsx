import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, Info, Activity } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import RobustLesionProgressionHeatmap from '../RobustLesionProgressionHeatmap';
import toast from 'react-hot-toast';

interface HeatmapData {
  gene: string;
  metabolic_trait: string;
  association_strength: number;
  is_causal: boolean;
  group: string;
}

interface LesionDataset {
  title: string;
  description: string;
  data: HeatmapData[];
}

type SortField = keyof HeatmapData;
type SortDirection = 'asc' | 'desc' | null;

const LesionProgressionPage: React.FC = () => {
  const [data, setData] = useState<LesionDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGene, setSelectedGene] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedCausal, setSelectedCausal] = useState('all');
  const [sortField, setSortField] = useState<SortField>('gene');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedCell, setSelectedCell] = useState<HeatmapData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/lesion_progression_heatmap.json`);
        const lesionData = await response.json();
        setData(lesionData);
      } catch (error) {
        console.error('Error loading lesion progression data:', error);
        toast.error('Failed to load lesion progression data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const uniqueGenes = useMemo(() => {
    if (!data) return [];
    const genes = [...new Set(data.data.map(item => item.gene))]
      .filter(gene => gene && gene.trim() !== '')
      .sort();
    return genes;
  }, [data]);

  const uniqueGroups = useMemo(() => {
    if (!data) return [];
    const groups = [...new Set(data.data.map(item => item.group))]
      .filter(group => group && group.trim() !== '')
      .sort();
    return groups;
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.data.filter(item => {
      const matchesSearch = !searchTerm || 
        (item.gene && item.gene.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.metabolic_trait && item.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.group && item.group.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGene = selectedGene === 'all' || item.gene === selectedGene;
      const matchesGroup = selectedGroup === 'all' || item.group === selectedGroup;
      const matchesCausal = selectedCausal === 'all' || 
        (selectedCausal === 'causal' && item.is_causal === true) ||
        (selectedCausal === 'non-causal' && item.is_causal === false);

      return matchesSearch && matchesGene && matchesGroup && matchesCausal;
    });

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        // Handle numeric sorting for association_strength field
        if (sortField === 'association_strength') {
          aVal = Number(aVal);
          bVal = Number(bVal);
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle boolean sorting for is_causal field
        if (sortField === 'is_causal') {
          return sortDirection === 'asc' ? 
            (aVal === bVal ? 0 : aVal ? 1 : -1) : 
            (aVal === bVal ? 0 : aVal ? -1 : 1);
        }
        
        // String sorting for other fields
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, selectedGene, selectedGroup, selectedCausal, sortField, sortDirection]);

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
        setSortField('gene');
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getCausalColor = (causal: boolean) => {
    if (causal) {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getGroupColor = (group: string) => {
    const colors: { [key: string]: string } = {
      'C': 'bg-blue-100 text-blue-800',
      'CE': 'bg-green-100 text-green-800',
      'FC': 'bg-purple-100 text-purple-800',
      'PL': 'bg-orange-100 text-orange-800',
      'TG': 'bg-red-100 text-red-800',
      'L': 'bg-indigo-100 text-indigo-800',
      'P': 'bg-yellow-100 text-yellow-800'
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
        gene: selectedGene,
        group: selectedGroup,
        causal: selectedCausal
      },
      total_records: filteredAndSortedData.length,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lesion-progression-heatmap.json';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Lesion progression data exported successfully!');
  };

  const exportCSV = () => {
    if (!data) return;
    
    const headers = ['Gene', 'Metabolic Trait', 'Association Strength', 'Group', 'Causal'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedData.map(row => [
        `"${row.gene}"`,
        `"${row.metabolic_trait}"`,
        row.association_strength,
        `"${row.group}"`,
        `"${row.is_causal ? 'Yes' : 'No'}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lesion-progression-heatmap.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Lesion progression data exported as CSV!');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lesion progression data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load lesion progression data. Please try refreshing the page.</p>
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
              GIMs for Gastric Lesion Progression - Gene-Trait Heatmap
            </h1>
            <p className="text-gray-600">
              Interactive heatmap showing gene-metabolic trait associations for {filteredAndSortedData.filter(item => item.is_causal === true).length} causal relationships 
              from {uniqueGenes.length} genes and {data.data.length} total associations
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportCSV}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportData}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
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
                  placeholder="Search gene, trait, group..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gene</label>
              <Select value={selectedGene} onValueChange={setSelectedGene}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gene" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genes ({uniqueGenes.length})</SelectItem>
                  {uniqueGenes.map(gene => (
                    <SelectItem key={gene} value={gene}>{gene}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Group</label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Causal Status</label>
              <Select value={selectedCausal} onValueChange={setSelectedCausal}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({filteredAndSortedData.length})</SelectItem>
                  <SelectItem value="causal">Causal ({filteredAndSortedData.filter(item => item.is_causal === true).length})</SelectItem>
                  <SelectItem value="non-causal">Non-causal ({filteredAndSortedData.filter(item => item.is_causal === false).length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <div>Showing {filteredAndSortedData.length} estimates</div>
                <div className="text-xs text-gray-500 mt-1">
                  {filteredAndSortedData.filter(item => item.is_causal === true).length} causal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Effect Estimates Plot */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Effect Estimates Comparison Plot</h3>
              <p className="text-gray-600 text-sm">
                Interactive heatmap showing gene-metabolic trait associations. Causal relationships marked with "*" in the cells.
                Color intensity represents association strength.
              </p>
            </div>
            
            <div className="overflow-auto">
              <RobustLesionProgressionHeatmap
                data={filteredAndSortedData}
                onCellClick={setSelectedCell}
              />
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="space-y-6">
          {/* Group Legend */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Metabolic Trait Groups</h3>
            <div className="space-y-2">
              {uniqueGroups.map(group => (
                <div key={group} className="flex items-center justify-between">
                  <Badge className={getGroupColor(group)}>
                    {group}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {filteredAndSortedData.filter(item => item.group === group).length}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Cell Details */}
          {selectedCell ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Association Details</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="font-medium text-indigo-700 mb-1">
                    {selectedCell.gene} → {selectedCell.metabolic_trait.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Association Strength</div>
                    <div className="font-mono text-lg text-gray-900">
                      {selectedCell.association_strength.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Group</div>
                    <Badge className={getGroupColor(selectedCell.group)}>
                      {selectedCell.group}
                    </Badge>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700">Causal Status</div>
                  <Badge className={getCausalColor(selectedCell.is_causal)}>
                    {selectedCell.is_causal ? 'Causal' : 'Non-causal'}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Gene-Trait Association</h3>
              <p className="text-gray-600 text-sm">
                Click on any cell in the heatmap to view detailed information about that gene-trait association.
              </p>
            </div>
          )}

          {/* Summary Statistics */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary Statistics</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div><strong>Total Associations:</strong> {filteredAndSortedData.length}</div>
              <div><strong>Unique Genes:</strong> {uniqueGenes.length}</div>
              <div><strong>Causal Relationships:</strong> {filteredAndSortedData.filter(item => item.is_causal === true).length}</div>
              <div><strong>Trait Groups:</strong> {uniqueGroups.length}</div>
              <div><strong>Average Association:</strong> {(filteredAndSortedData.reduce((sum, item) => sum + item.association_strength, 0) / filteredAndSortedData.length).toFixed(4)}</div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default LesionProgressionPage;

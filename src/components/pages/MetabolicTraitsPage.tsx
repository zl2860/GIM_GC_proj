// src/components/pages/MetabolicTraitsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Beaker, Info } from 'lucide-react';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import toast from 'react-hot-toast';

interface MetabolicTraitData {
  metabolic_trait: string;
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
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<MetabolicTraitDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedSubGroup, setSelectedSubGroup] = useState('all');
  const [sortField, setSortField] = useState<SortField>('metabolic_trait');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedTrait, setSelectedTrait] = useState<MetabolicTraitData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Auto-fill from query param ?q=
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchTerm(q);
      setCurrentPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/biomarker_information.json`
        );
        const traitData = await response.json();
        setData(traitData);
      } catch (error) {
        console.error('Error loading metabolomic trait data:', error);
        toast.error('Failed to load metabolomic trait information');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const uniqueGroups = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.data.map(item => item.group)))
      .filter(g => g && g !== '-')
      .sort();
  }, [data]);

  const uniqueSubGroups = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(
        data.data
          .filter(item => selectedGroup === 'all' || item.group === selectedGroup)
          .map(item => item.sub_group)
          .filter(sg => sg && sg !== '-')
      )
    ).sort();
  }, [data, selectedGroup]);

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.data.filter(item => {
      const matchesSearch =
        !searchTerm ||
        item.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.group.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.units.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGroup = selectedGroup === 'all' || item.group === selectedGroup;
      const matchesSubGroup =
        selectedSubGroup === 'all' || item.sub_group === selectedSubGroup;

      return matchesSearch && matchesGroup && matchesSubGroup;
    });

    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return filtered;
  }, [data, searchTerm, selectedGroup, selectedSubGroup, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(start, start + itemsPerPage);
  }, [filteredAndSortedData, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev =>
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortField('metabolic_trait');
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
    const colors: Record<string, string> = {
      Cholesterol: 'bg-red-100 text-red-800',
      Triglycerides: 'bg-blue-100 text-blue-800',
      'Fatty Acids': 'bg-green-100 text-green-800',
      'Amino Acids': 'bg-purple-100 text-purple-800',
      'Glycolysis Related': 'bg-yellow-100 text-yellow-800',
      'Ketone Bodies': 'bg-indigo-100 text-indigo-800',
      Inflammation: 'bg-orange-100 text-orange-800',
      'Fluid Balance': 'bg-teal-100 text-teal-800'
    };
    return colors[group] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[20rem]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading metabolomic trait information...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">
          Failed to load metabolomic trait information. Please refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
          The 249 ¹H-NMR blood metabolomic traits in the UK Biobank
          </h1>
          <p className="text-gray-600">
            Annotations, units, biological groupings, and related information for the 249 metabolomic traits (18 categories) quantified by ¹H-NMR in UKBB.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search traits, descriptions..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
          <Select
            value={selectedGroup}
            onValueChange={value => {
              setSelectedGroup(value);
              setSelectedSubGroup('all');
              setCurrentPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={`All Groups (${uniqueGroups.length})`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups ({uniqueGroups.length})</SelectItem>
              {uniqueGroups.map(g => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub Group</label>
          <Select
            value={selectedSubGroup}
            onValueChange={value => {
              setSelectedSubGroup(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={`All Sub Groups (${uniqueSubGroups.length})`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All Sub Groups ({uniqueSubGroups.length})
              </SelectItem>
              {uniqueSubGroups.map(sg => (
                <SelectItem key={sg} value={sg}>
                  {sg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end text-sm text-gray-600">
          Showing {paginatedData.length} of {filteredAndSortedData.length} traits
        </div>
      </div>

      {/* Table & Details */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('metabolic_trait')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Metabolomic Trait</span>
                      {getSortIcon('metabolic_trait')}
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
                {paginatedData.map((row, idx) => (
                  <TableRow
                    key={row.metabolic_trait}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTrait(row)}
                  >
                    <TableCell className="font-medium text-purple-700">
                      {row.metabolic_trait.replace(/_/g, '_')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={row.description}>
                      {row.description}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">
                      {row.units}
                    </TableCell>
                    <TableCell>
                      <Badge className={getGroupColor(row.group)}>
                        {row.group}
                      </Badge>
                      {row.sub_group && row.sub_group !== '-' && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          {row.sub_group}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} ({filteredAndSortedData.length} total)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(
                    1,
                    Math.min(totalPages - 4, currentPage - 2)
                  ) + i;
                  if (page > totalPages) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-sm border rounded ${
                        page === currentPage
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {selectedTrait ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Metabolomic Trait Details
                </h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="font-medium text-gray-900 mb-1">
                    {selectedTrait.metabolic_trait.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedTrait.description}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Unit</div>
                    <div className="font-mono text-sm text-gray-900">
                      {selectedTrait.units}
                    </div>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Select a Metabolomic Trait
              </h3>
              <p className="text-gray-600 text-sm">
                Click a row to view detailed information.
              </p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Group Summary</h3>
            <div className="space-y-2 text-sm text-gray-600">
              {uniqueGroups.map(g => {
                const count = data.data.filter(d => d.group === g).length;
                return (
                  <div key={g} className="flex justify-between">
                    <Badge className={getGroupColor(g)}>{g}</Badge>
                    <span>{count} traits</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">
            {filteredAndSortedData.length}
          </div>
          <div className="text-sm text-gray-600">Filtered Traits</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{uniqueGroups.length}</div>
          <div className="text-sm text-gray-600">Trait Groups</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {uniqueSubGroups.length}
          </div>
          <div className="text-sm text-gray-600">Sub Groups</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">
            {data.data.filter(d => d.group === 'Cholesterol').length}
          </div>
          <div className="text-sm text-gray-600">Cholesterol Traits</div>
        </div>
      </div>
    </div>
  );
};

export default MetabolicTraitsPage;
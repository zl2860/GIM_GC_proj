// src/components/pages/GCGimsPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, Filter, Info, Network } from 'lucide-react';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Badge } from '../ui/badge';
import GCGimHeatmap from '../GCGimHeatmap';
import toast from 'react-hot-toast';

interface GCGimData {
  gene: string;
  Biomarker: string;
  'value.update': string;
  P_value: number;
  Metabolite: string;
  'Beta.pred': number;
  'Beta.pred.lower': number;
  'Beta.pred.upper': number;
  Exposure: string;
  'Beta.true': number;
  'Beta.true.lower': number;
  'Beta.true.upper': number;
  ID: string;
  'Beta.MR': number;
  'Beta.MR.lower': number;
  'Beta.MR.upper': number;
  all_same_direction: boolean;
  is_causal: string;
}

interface GCGimDataset {
  title: string;
  description: string;
  data: GCGimData[];
}

const GCGimsPage: React.FC = () => {
  const [data, setData] = useState<GCGimDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGene, setSelectedGene] = useState('all');
  const [selectedMetabolite, setSelectedMetabolite] = useState('all');
  const [selectedFunctional, setSelectedFunctional] = useState('all');
  const [selectedAssociation, setSelectedAssociation] = useState<
    GCGimData | null
  >(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/gc_gim_heatmap.json`);
        const gcGimData = await response.json();
        setData(gcGimData);
      } catch (error) {
        console.error('Error loading GC GIM data:', error);
        toast.error('Failed to load GC GIM data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const uniqueGenes = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.data.map((d) => d.gene)))
      .filter((g) => g.trim())
      .sort();
  }, [data]);

  const uniqueMetabolites = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.data.map((d) => d.Metabolite)))
      .filter((m) => m.trim())
      .sort();
  }, [data]);

  const uniqueFunctionalTypes = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.data.map((d) => d['value.update'])))
      .filter((t) => typeof t === 'string' && t.trim())
      .sort();
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.data.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.gene.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Metabolite.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.Exposure.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGene =
        selectedGene === 'all' || item.gene === selectedGene;
      const matchesMetabolite =
        selectedMetabolite === 'all' ||
        item.Metabolite === selectedMetabolite;
      const matchesFunctional =
        selectedFunctional === 'all' ||
        item['value.update'] === selectedFunctional;

      return (
        matchesSearch && matchesGene && matchesMetabolite && matchesFunctional
      );
    });
  }, [
    data,
    searchTerm,
    selectedGene,
    selectedMetabolite,
    selectedFunctional
  ]);

  const getFunctionalColor = (type: string) => {
    const map: Record<string, string> = {
      intronic: 'bg-blue-100 text-blue-800',
      UTR5: 'bg-green-100 text-green-800',
      intergenic: 'bg-purple-100 text-purple-800',
      downstream: 'bg-orange-100 text-orange-800',
      ncRNA_intronic: 'bg-red-100 text-red-800',
      exonic: 'bg-indigo-100 text-indigo-800',
      UTR3: 'bg-yellow-100 text-yellow-800',
      upstream: 'bg-pink-100 text-pink-800',
      ncRNA_exonic: 'bg-teal-100 text-teal-800'
    };
    return map[type] ?? 'bg-gray-100 text-gray-800';
  };

  const exportData = () => {
    if (!data) return;
    const payload = {
      title: data.title,
      description: data.description,
      filtered_data: filteredData,
      filters: {
        search: searchTerm,
        gene: selectedGene,
        metabolite: selectedMetabolite,
        functional_type: selectedFunctional
      },
      total_records: filteredData.length,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gc-gims-associations.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('GC GIMs data exported successfully!');
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = [
      'Gene',
      'Metabolite',
      'Functional Type',
      'P-value',
      'Beta Pred',
      'Beta True',
      'Beta MR',
      'Is Causal'
    ];
    const rows = filteredData.map((d) => [
      `"${d.gene}"`,
      `"${d.Metabolite}"`,
      `"${d['value.update']}"`,
      d.P_value,
      d['Beta.pred'],
      d['Beta.true'],
      d['Beta.MR'],
      `"${d.is_causal}"`
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gc-gims-associations.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('GC GIMs data exported as CSV!');
  };

  if (loading)
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-green-600 rounded-full" />
      </div>
    );
  if (!data)
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load GC GIMs data. Please refresh.
      </div>
    );

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            GIMs for Gastric Cancer
          </h1>
          <p className="text-gray-600">
            Interactive heatmap of putative causal gene–metabolic trait
            associations (functional annotation color coded).
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={exportCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button
            onClick={exportData}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center mb-3 space-x-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filters & Search</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search gene, trait, exposure…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Gene</label>
            <Select
              value={selectedGene}
              onValueChange={setSelectedGene}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Genes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Genes ({uniqueGenes.length})
                </SelectItem>
                {uniqueGenes.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Metabolite
            </label>
            <Select
              value={selectedMetabolite}
              onValueChange={setSelectedMetabolite}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Traits" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Traits ({uniqueMetabolites.length})
                </SelectItem>
                {uniqueMetabolites.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Functional Type
            </label>
            <Select
              value={selectedFunctional}
              onValueChange={setSelectedFunctional}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Types ({uniqueFunctionalTypes.length})
                </SelectItem>
                {uniqueFunctionalTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-sm text-gray-600">
              Showing {filteredData.length} associations ·{' '}
              <Badge
                className="bg-red-100 text-red-800 border-red-200"
              >
                {
                  filteredData.filter((d) => d.is_causal === 'Yes')
                    .length
                }{' '}
                causal
              </Badge>
            </p>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Gene–Metabolic Trait Heatmap
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Click on any cell to view detailed association info.
          </p>
          <div className="overflow-auto">
            <GCGimHeatmap
              data={filteredData}
              genes={uniqueGenes}
              metabolites={uniqueMetabolites}
              onAssociationClick={setSelectedAssociation}
            />
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {selectedAssociation ? (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="flex items-center mb-4 space-x-2">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Association Details
                </h3>
              </div>
              {/* ... your details markup remains unchanged ... */}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-lg text-center text-gray-600">
              <Network className="mx-auto w-12 h-12 mb-3 text-gray-400" />
              <p>Click a cell to view association details.</p>
            </div>
          )}
          
          {/* Legend & Stats */}
          <div className="bg-white p-6 rounded-lg shadow-lg space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Functional Annotation Legend
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {uniqueFunctionalTypes.map((t) => (
                <div key={t} className="flex items-center space-x-2">
                  <Badge className={getFunctionalColor(t)}>{t}</Badge>
                  <span className="text-sm text-gray-600">
                    {
                      filteredData.filter((d) => d['value.update'] === t)
                        .length
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GCGimsPage;
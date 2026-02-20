import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Info, Network } from 'lucide-react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGene, setSelectedGene] = useState('all');
  const [selectedMetabolite, setSelectedMetabolite] = useState('all');
  const [selectedFunctional, setSelectedFunctional] = useState('all');
  const [selectedAssociation, setSelectedAssociation] = useState<GCGimData | null>(null);
  const [geneSort, setGeneSort] = useState<'alphabetical' | 'pValue'>('alphabetical');
  const [showCausalOnly, setShowCausalOnly] = useState(false);
  const [activeGene, setActiveGene] = useState<string | null>(null);

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
    const genes = [...new Set(data.data.map(item => item.gene))]
      .filter(gene => gene && gene.trim() !== '')
      .sort();
    return genes;
  }, [data]);

  const uniqueMetabolites = useMemo(() => {
    if (!data) return [];
    const metabolites = [...new Set(data.data.map(item => item.Metabolite))]
      .filter(metabolite => metabolite && metabolite.trim() !== '')
      .sort();
    return metabolites;
  }, [data]);

  const uniqueFunctionalTypes = useMemo(() => {
    if (!data) return [];
    const types = [...new Set(data.data.map(item => item['value.update']))]
      .filter(type => type && type !== null && typeof type === 'string' && type.trim() !== '')
      .sort();
    return types;
  }, [data]);

  useEffect(() => {
    const rawQuery = searchParams.get('q')?.trim();
    if (!rawQuery) return;
    const normalized = rawQuery.toLowerCase();
    const matchedGene = uniqueGenes.find(gene => gene.toLowerCase() === normalized);
    if (matchedGene) {
      setSelectedGene(matchedGene);
      setSearchTerm('');
      return;
    }
    const matchedMetabolite = uniqueMetabolites.find(
      metabolite => metabolite.toLowerCase() === normalized
    );
    if (matchedMetabolite) {
      setSelectedMetabolite(matchedMetabolite);
      setSearchTerm('');
      return;
    }
    setSearchTerm(rawQuery);
  }, [searchParams, uniqueGenes, uniqueMetabolites]);

  const filteredData = useMemo(() => {
    if (!data) return [];

    return data.data.filter(item => {
      const matchesSearch = !searchTerm || 
        (item.gene && item.gene.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.Metabolite && item.Metabolite.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.Exposure && item.Exposure.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesGene = selectedGene === 'all' || item.gene === selectedGene;
      const matchesMetabolite = selectedMetabolite === 'all' || item.Metabolite === selectedMetabolite;
      const matchesFunctional = selectedFunctional === 'all' || (item['value.update'] && item['value.update'] === selectedFunctional);

      return matchesSearch && matchesGene && matchesMetabolite && matchesFunctional;
    });
  }, [data, searchTerm, selectedGene, selectedMetabolite, selectedFunctional]);

  const getFunctionalColor = (functionalType: string) => {
    const colors: { [key: string]: string } = {
      'intronic': 'bg-blue-100 text-blue-800',
      'UTR5': 'bg-green-100 text-green-800',
      'intergenic': 'bg-purple-100 text-purple-800',
      'downstream': 'bg-orange-100 text-orange-800',
      'ncRNA_intronic': 'bg-red-100 text-red-800',
      'exonic': 'bg-indigo-100 text-indigo-800',
      'UTR3': 'bg-yellow-100 text-yellow-800',
      'upstream': 'bg-pink-100 text-pink-800',
      'ncRNA_exonic': 'bg-teal-100 text-teal-800'
    };
    return colors[functionalType] || 'bg-gray-100 text-gray-800';
  };

  const workingData = useMemo(() => {
    return showCausalOnly
      ? filteredData.filter(item => item.is_causal === 'Yes')
      : filteredData;
  }, [filteredData, showCausalOnly]);

  const geneStats = useMemo(() => {
    const stats = new Map<string, { minP: number }>();

    workingData.forEach(item => {
      const current = stats.get(item.gene);
      if (!current || item.P_value < current.minP) {
        stats.set(item.gene, { minP: item.P_value });
      }
    });

    return stats;
  }, [workingData]);

  const heatmapGenes = useMemo(() => {
    const genesAvailable = [...new Set(workingData.map(item => item.gene))];

    if (geneSort === 'pValue') {
      return genesAvailable.sort((a, b) => {
        const statsA = geneStats.get(a);
        const statsB = geneStats.get(b);
        const pA = statsA?.minP ?? Number.POSITIVE_INFINITY;
        const pB = statsB?.minP ?? Number.POSITIVE_INFINITY;
        return pA - pB;
      });
    }

    return genesAvailable.sort();
  }, [workingData, geneSort, geneStats]);

  const heatmapMetabolites = useMemo(() => {
    return [...new Set(workingData.map(item => item.Metabolite))].sort();
  }, [workingData]);

  useEffect(() => {
    if (!heatmapGenes.length) {
      setActiveGene(null);
      return;
    }

    if (!activeGene || !heatmapGenes.includes(activeGene)) {
      setActiveGene(heatmapGenes[0]);
    }
  }, [heatmapGenes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeneSelect = (value: string) => {
    setSelectedGene(value);
    if (value !== 'all') {
      setActiveGene(value);
    }
  };

  useEffect(() => {
    if (selectedGene !== 'all') {
      setActiveGene(selectedGene);
    }
  }, [selectedGene]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GC GIMs data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load GC GIMs data. Please try refreshing the page.</p>
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
              Co-regulatory Genetic Effects of the GIM for Gastric Cancer
            </h1>
            <p className="text-gray-600">
              The interactive heatmap shows putative causal relationships between gene loci (for the nearest genes functionally annotated by the lead variants based on both distance and variant functions) and metabolomic traits 
              for gastric cancer.
            </p>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filters, Search & Display Options</h3>
          </div>
          
          <div className="space-y-4">
            {/* Main filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search gene or trait"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gene</label>
                <Select value={selectedGene} onValueChange={handleGeneSelect}>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Metabolomic Trait</label>
                <Select value={selectedMetabolite} onValueChange={setSelectedMetabolite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trait" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Traits ({uniqueMetabolites.length})</SelectItem>
                    {uniqueMetabolites.map(metabolite => (
                      <SelectItem key={metabolite} value={metabolite}>
                        {metabolite ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Functional Type</label>
                <Select value={selectedFunctional} onValueChange={setSelectedFunctional}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types ({uniqueFunctionalTypes.length})</SelectItem>
                    {uniqueFunctionalTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <div className="text-sm text-gray-600">
                  <div>Showing {filteredData.length} associations</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {filteredData.filter(item => item.is_causal === 'Yes').length} putative causal
                  </div>
                </div>
              </div>
            </div>

            {/* Display options */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Display Options</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gene ordering</label>
                  <Select value={geneSort} onValueChange={value => setGeneSort(value as 'alphabetical' | 'pValue')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ordering" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alphabetical">Alphabetical</SelectItem>
                      <SelectItem value="pValue">Smallest P-value first (min P across a gene)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-500">
                    When choosing “Smallest P-value”, genes are ordered by the minimum P-value observed among their associations.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="causal-checkbox"
                    type="checkbox"
                    checked={showCausalOnly}
                    onChange={event => setShowCausalOnly(event.target.checked)}
                    className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <label htmlFor="causal-checkbox" className="text-sm text-gray-700">
                    Show only putative causal associations
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8 lg:items-start">
        {/* Heatmap */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">The GIM for GC</h3>
              <p className="text-gray-600 text-sm">
                Interactive heatmap showing associations between {uniqueGenes.length} genes and {uniqueMetabolites.length} metabolomic traits. 
                Colors represent functional annotation types. "*" indicates putative causal relationships identified by CSL models.
              </p>
            </div>
            
            <div className="overflow-auto">
              <GCGimHeatmap
                data={workingData}
                genes={heatmapGenes}
                metabolites={heatmapMetabolites}
                onAssociationClick={(assoc) => {
                  setSelectedAssociation(assoc);
                  setActiveGene(assoc.gene);
                }}
                activeGene={activeGene}
              />
            </div>
          </div>
        </div>

        {/* Details Panel - Sticky positioned for better alignment */}
        <div className="lg:sticky lg:top-6 lg:self-start lg:max-h-screen lg:overflow-y-auto">
          <div className="space-y-6">
          {/* Functional Type Legend */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Functional Annotations</h3>
            <div className="space-y-2">
              {uniqueFunctionalTypes.map(type => (
                <div key={type} className="flex items-center justify-between">
                  <Badge className={getFunctionalColor(type)}>
                    {type}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {filteredData.filter(item => item['value.update'] === type).length}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-lg">*</span>
                <span className="text-sm text-gray-600">Indicates putative causal relationship</span>
              </div>
            </div>
          </div>

          {/* Selected Association Details */}
          {selectedAssociation ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                <Info className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Association Details</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="font-medium text-green-700 mb-1">
                    {selectedAssociation.gene} → {selectedAssociation.Metabolite}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedAssociation.Exposure}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700">Functional Type</div>
                  <Badge className={getFunctionalColor(selectedAssociation['value.update'])}>
                    {selectedAssociation['value.update']}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700">P-value</div>
                    <div className="font-mono text-sm text-gray-900">
                      {selectedAssociation.P_value.toExponential(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Putative causal</div>
                    <Badge variant={selectedAssociation.is_causal === 'Yes' ? 'destructive' : 'secondary'}>
                      {selectedAssociation.is_causal}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Beta Estimates for GC incidence risk:</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">by predicted levels:</span>
                      <span className="font-mono">
                        {selectedAssociation['Beta.pred'].toFixed(3)} 
                        ({selectedAssociation['Beta.pred.lower'].toFixed(2)}, {selectedAssociation['Beta.pred.upper'].toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">by actual levels:</span>
                      <span className="font-mono">
                        {selectedAssociation['Beta.true'].toFixed(3)}
                        ({selectedAssociation['Beta.true.lower'].toFixed(2)}, {selectedAssociation['Beta.true.upper'].toFixed(2)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">by Mendelian randomization:</span>
                      <span className="font-mono">
                        {selectedAssociation['Beta.MR'].toFixed(3)}
                        ({selectedAssociation['Beta.MR.lower'].toFixed(2)}, {selectedAssociation['Beta.MR.upper'].toFixed(2)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <Network className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Association</h3>
              <p className="text-gray-600 text-sm">
                Click on any cell in the heatmap to view detailed information about that gene–metabolomic trait association.
              </p>
            </div>
          )}

          {/* Summary Statistics */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Statistics</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div><strong>Total Associations:</strong> {filteredData.length}</div>
              <div><strong>Unique Genes:</strong> {uniqueGenes.length}</div>
              <div><strong>Unique Metabolomic Traits:</strong> {uniqueMetabolites.length}</div>
                <div><strong>Putative Causal Relationships:</strong> {filteredData.filter(item => item.is_causal === 'Yes').length}</div>
              <div><strong>Functional Types:</strong> {uniqueFunctionalTypes.length}</div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GCGimsPage;

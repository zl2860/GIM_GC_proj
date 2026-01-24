import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ExternalLink, Filter, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface SearchResult {
  id: string;
  type: 'gene' | 'trait' | 'variant' | 'region';
  name: string;
  description?: string;
  details?: string;
  link?: string;
  matchFields?: string[];
}

const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    if (!query) {
      navigate('/');
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      try {
        // Search in traits/biomarkers
        const traitsResponse = await fetch(
          `${import.meta.env.BASE_URL}data/biomarker_information.json`
        );
        const traitsData = await traitsResponse.json();

        // Search in CSL loci (genes)
        const lociResponse = await fetch(
          `${import.meta.env.BASE_URL}data/csl_loci_2026.json`
        );
        const lociData = await lociResponse.json();

        // Search in variants
        const variantsResponse = await fetch(
          `${import.meta.env.BASE_URL}data/matched_variants_2026.json`
        );
        const variantsData = await variantsResponse.json();

        const foundResults: SearchResult[] = [];
        const searchLower = query.toLowerCase();

        // Search traits
        if (traitsData.data) {
          traitsData.data.forEach((trait: any) => {
            if (
              trait.metabolic_trait?.toLowerCase().includes(searchLower) ||
              trait.description?.toLowerCase().includes(searchLower) ||
              trait.group?.toLowerCase().includes(searchLower)
            ) {
              foundResults.push({
                id: `trait-${trait.metabolic_trait}`,
                type: 'trait',
                name: trait.metabolic_trait,
                description: trait.description,
                details: `${trait.group}${trait.sub_group !== '-' ? ` - ${trait.sub_group}` : ''}`,
                link: '/metabolic-traits',
                matchFields: [
                  trait.metabolic_trait,
                  trait.description,
                  trait.group
                ].filter((f) => f?.toLowerCase().includes(searchLower))
              });
            }
          });
        }

        // Search genes
        if (lociData.data) {
          lociData.data.forEach((geneData: any) => {
            if (geneData.gene?.toLowerCase().includes(searchLower)) {
              const traitGroups = (geneData.trait_groups || [])
                .map((tg: any) => tg.trait_group)
                .join(', ');
              foundResults.push({
                id: `gene-${geneData.gene}`,
                type: 'gene',
                name: geneData.gene,
                description: `Gene locus with ${geneData.trait_groups?.length || 0} trait associations`,
                details: `Trait groups: ${traitGroups}`,
                link: '/csl-loci',
                matchFields: [geneData.gene]
              });
            }
          });
        }

        // Search variants
        if (variantsData.data) {
          variantsData.data.forEach((variant: any) => {
            if (
              variant.reportedVariant?.toLowerCase().includes(searchLower) ||
              variant.nearestGene?.toLowerCase().includes(searchLower)
            ) {
              foundResults.push({
                id: `variant-${variant.reportedVariant}`,
                type: 'variant',
                name: variant.reportedVariant,
                description: `Chr${variant.chromosome}:${variant.position}`,
                details: `Nearest gene: ${variant.nearestGene}`,
                link: '/variants',
                matchFields: [
                  variant.reportedVariant,
                  variant.nearestGene
                ].filter((f) => f?.toLowerCase().includes(searchLower))
              });
            }
          });
        }

        // Search genomic regions (from variants)
        if (variantsData.data) {
          const regionMatches = new Set<string>();
          variantsData.data.forEach((variant: any) => {
            const chrPattern = `chr${variant.chromosome}`;
            if (chrPattern.toLowerCase().includes(searchLower)) {
              regionMatches.add(chrPattern);
            }
          });

          regionMatches.forEach((region) => {
            foundResults.push({
              id: `region-${region}`,
              type: 'region',
              name: region,
              description: 'Genomic region with associated variants',
              details: `Related to gastric cancer susceptibility`,
              link: '/variants'
            });
          });
        }

        setResults(foundResults);
        if (foundResults.length === 0) {
          toast.error('No results found for your search');
        }
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to perform search');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [query, navigate]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gene':
        return {
          bg: 'bg-lime-50',
          border: 'border-lime-200',
          badge: 'bg-lime-100 text-lime-800 border-lime-300',
          icon: 'text-lime-600',
          header: 'bg-lime-600 text-white'
        };
      case 'trait':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          badge: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: 'text-purple-600',
          header: 'bg-purple-600 text-white'
        };
      case 'variant':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          icon: 'text-yellow-600',
          header: 'bg-yellow-600 text-white'
        };
      case 'region':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: 'text-blue-600',
          header: 'bg-blue-600 text-white'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          badge: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: 'text-gray-600',
          header: 'bg-gray-600 text-white'
        };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'gene':
        return 'Gene';
      case 'trait':
        return 'Metabolite';
      case 'variant':
        return 'Variant';
      case 'region':
        return 'Region';
      default:
        return 'Result';
    }
  };

  // Group results by type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  const filteredGroups =
    selectedType === 'all'
      ? groupedResults
      : { [selectedType]: groupedResults[selectedType] || [] };

  const typeOrder: Array<'gene' | 'trait' | 'variant' | 'region'> = [
    'gene',
    'trait',
    'variant',
    'region'
  ];
  const sortedTypes = typeOrder.filter((t) => t in filteredGroups);

  const handleResultClick = (result: SearchResult) => {
    if (result.link) {
      navigate(result.link);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Results</h1>
        <p className="text-lg text-gray-600">
          Search for: <span className="font-semibold text-gray-900">"{query}"</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Found {results.length} result{results.length !== 1 ? 's' : ''} across{' '}
          {sortedTypes.length} categor{sortedTypes.length === 1 ? 'y' : 'ies'}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-500 mt-4">Searching...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">No results found for "{query}"</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to homepage
          </button>
        </div>
      ) : (
        <>
          {/* Filter */}
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-gray-500" />
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedType === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({results.length})
            </button>
            {typeOrder.map((type) => {
              const count = groupedResults[type]?.length || 0;
              if (count === 0) return null;
              const colors = getTypeColor(type);
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedType === type
                      ? `${colors.header}`
                      : `bg-gray-100 text-gray-700 hover:bg-gray-200`
                  }`}
                >
                  {getTypeLabel(type)} ({count})
                </button>
              );
            })}
          </div>

          {/* Results by Category */}
          <div className="space-y-8">
            {sortedTypes.map((type) => {
              const typeResults = filteredGroups[type] || [];
              if (typeResults.length === 0) return null;

              const colors = getTypeColor(type);
              return (
                <div key={type} className={`rounded-lg border-2 ${colors.border} overflow-hidden`}>
                  {/* Category Header */}
                  <div className={`${colors.header} px-6 py-4`}>
                    <h2 className="text-xl font-bold">
                      {getTypeLabel(type)}s ({typeResults.length})
                    </h2>
                  </div>

                  {/* Results List */}
                  <div className="divide-y divide-gray-200">
                    {typeResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className={`w-full px-6 py-4 text-left hover:${colors.bg} transition flex items-start justify-between gap-4 group`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${colors.badge}`}
                            >
                              {getTypeLabel(result.type)}
                            </span>
                            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition">
                              {result.name}
                            </h3>
                          </div>
                          {result.description && (
                            <p className="text-gray-600 text-sm mb-1">{result.description}</p>
                          )}
                          {result.details && (
                            <p className="text-gray-500 text-xs">{result.details}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <ExternalLink className={`w-5 h-5 ${colors.icon} opacity-0 group-hover:opacity-100 transition`} />
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-600 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default SearchResultsPage;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ExternalLink } from 'lucide-react';
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

const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const search = async () => {
      setIsSearching(true);
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

        // Limit results to top 20
        setResults(foundResults.slice(0, 20));
        setShowResults(true);

        if (foundResults.length === 0) {
          toast.error('No results found');
        }
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to perform search');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    if (result.link) {
      navigate(result.link);
      setQuery('');
      setShowResults(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'gene':
        return 'bg-lime-100 text-lime-800 border-lime-300';
      case 'trait':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'variant':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'region':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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

  return (
    <div className="w-full">
      <div className="relative">
        <div className="relative flex items-center bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:border-gray-300 transition">
          <Search className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search genes, traits, variants, or regions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setShowResults(true)}
            className="flex-1 px-4 py-3 outline-none text-gray-700 placeholder-gray-400 bg-white"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                setShowResults(false);
              }}
              className="pr-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Results Dropdown */}
        {showResults && (results.length > 0 || isSearching) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-gray-500">
                <div className="inline-block">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              </div>
            ) : (
              <>
                {results.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-600">
                        Found {results.length} result{results.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {results.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`inline-flex px-2 py-1 rounded text-xs font-semibold border ${getTypeColor(
                                  result.type
                                )}`}
                              >
                                {getTypeLabel(result.type)}
                              </span>
                              <p className="font-semibold text-gray-900 truncate">
                                {result.name}
                              </p>
                            </div>
                            {result.description && (
                              <p className="text-sm text-gray-600 line-clamp-1">
                                {result.description}
                              </p>
                            )}
                            {result.details && (
                              <p className="text-xs text-gray-500 line-clamp-1">
                                {result.details}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalSearch;

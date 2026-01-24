import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ExternalLink, Filter, ChevronRight, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface SearchResult {
  id: string;
  type: 'gene' | 'trait' | 'variant' | 'region';
  name: string;
  description?: string;
  details?: string;
  link?: string;
  matchFields?: string[];
  isGIMRelevant?: boolean;
  colocGene?: string; // Gene associated with variant/region from coloc_supplement.json
}

const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get('q') || '';

  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [hasGcGimMatch, setHasGcGimMatch] = useState(false);
  const [hasLesionMatch, setHasLesionMatch] = useState(false);
  const [hasNetworkMatch, setHasNetworkMatch] = useState(false);
  const [networkTraits, setNetworkTraits] = useState<Set<string>>(new Set());
  const [preferColocNetwork, setPreferColocNetwork] = useState(false);
  const [networkGenes, setNetworkGenes] = useState<Set<string>>(new Set());
  const [preferredColocGene, setPreferredColocGene] = useState<string>('');

  useEffect(() => {
    if (!initialQuery) {
      navigate('/');
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      setHasGcGimMatch(false);
      setHasLesionMatch(false);
      setHasNetworkMatch(false);
      try {
        // Search in traits/biomarkers
        const traitsResponse = await fetch(
          `${import.meta.env.BASE_URL}data/biomarker_information.json`
        );
        const traitsData = await traitsResponse.json();

        // Search in CSL loci (genes and regions)
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
        const matchedGenes = new Set<string>();
        const searchLower = initialQuery.toLowerCase();
        const matchesSearchTerm = (value?: string) =>
          typeof value === 'string' && value.toLowerCase().includes(searchLower);
        const foundRegions = new Set<string>();

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
                isGIMRelevant: true,
                matchFields: [
                  trait.metabolic_trait,
                  trait.description,
                  trait.group
                ].filter((f) => f?.toLowerCase().includes(searchLower))
              });
            }
          });
        }

        // Search genes and regions from CSL loci
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
                isGIMRelevant: true,
                matchFields: [geneData.gene]
              });
              matchedGenes.add(geneData.gene.toLowerCase());
            }

            // Search genomic regions (e.g., 9q31.2)
            if (geneData.trait_groups) {
              geneData.trait_groups.forEach((tg: any) => {
                if (tg.traits) {
                  tg.traits.forEach((trait: any) => {
                    if (trait.regions) {
                      trait.regions.forEach((region: string) => {
                        if (
                          region.toLowerCase().includes(searchLower) &&
                          !foundRegions.has(region)
                        ) {
                          foundRegions.add(region);
                          foundResults.push({
                            id: `region-${region}`,
                            type: 'region',
                            name: region,
                            description: `Genomic region associated with metabolomic traits`,
                            details: `Gene: ${geneData.gene} | Trait group: ${tg.trait_group}`,
                            link: '/csl-loci',
                            isGIMRelevant: true,
                            matchFields: [region]
                          });
                          matchedGenes.add(geneData.gene.toLowerCase());
                        }
                      });
                    }
                  });
                }
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
                isGIMRelevant: true,
                matchFields: [
                  variant.reportedVariant,
                  variant.nearestGene
                ].filter((f) => f?.toLowerCase().includes(searchLower))
              });
              if (variant.nearestGene) {
                matchedGenes.add(variant.nearestGene.toLowerCase());
              }
            }
          });
        }

        // Build network gene set from colocal nodes + supplemental data
        const networkGenesLocal = new Set<string>();
        const networkTraitsLocal = new Set<string>();
        const addGene = (g?: string) => {
          if (g) networkGenesLocal.add(g.toLowerCase());
        };
        const addTrait = (t?: string) => {
          if (t) networkTraitsLocal.add(t.toLowerCase());
        };

        try {
          const nodesResp = await fetch(
            `${import.meta.env.BASE_URL}data/coloc_network_webpage_nodes_df.csv`
          );
          const text = await nodesResp.text();
          const lines = text.trim().split(/\r?\n/);
          if (lines.length > 1) {
            const header = lines[0].split(',');
            const nodeIdx = header.findIndex((h) => h.trim().toLowerCase() === 'node');
            const typeIdx = header.findIndex((h) => h.trim().toLowerCase() === 'node_type');
            lines.slice(1).forEach((line) => {
              const parts = line.split(',');
              const node = parts[nodeIdx];
              const nodeType = parts[typeIdx];
              if (node && nodeType && nodeType.toLowerCase() === 'gene') {
                addGene(node);
              } else if (node && nodeType && nodeType.toLowerCase().includes('biomarker')) {
                addTrait(node);
              }
            });
          }
        } catch (err) {
          console.error('Failed to load colocal nodes', err);
        }

        // Track variant/region matches from coloc_supplement
        // Map: key is variant/region string, value is set of matching genes
        const variantMatches = new Map<string, Set<string>>(); // for hit1/hit2 (variants)
        const regionMatches = new Map<string, Set<string>>(); // for region

        try {
          const suppResp = await fetch(
            `${import.meta.env.BASE_URL}data/coloc_supplement.json`
          );
          const supp = await suppResp.json();
          if (Array.isArray(supp)) {
            supp.forEach((row: any) => {
              addGene(row.gene);
              addTrait(row.trait);
              const hit1 = row.hit1?.toLowerCase();
              const hit2 = row.hit2?.toLowerCase();
              const region = row.region?.toLowerCase();

              // Check for variant matches (hit1)
              if (hit1 && hit1.includes(searchLower)) {
                if (!variantMatches.has(row.hit1)) {
                  variantMatches.set(row.hit1, new Set<string>());
                }
                if (row.gene) {
                  variantMatches.get(row.hit1)!.add(row.gene);
                  matchedGenes.add(row.gene.toLowerCase());
                }
              }
              // Check for variant matches (hit2)
              if (hit2 && hit2.includes(searchLower)) {
                if (!variantMatches.has(row.hit2)) {
                  variantMatches.set(row.hit2, new Set<string>());
                }
                if (row.gene) {
                  variantMatches.get(row.hit2)!.add(row.gene);
                  matchedGenes.add(row.gene.toLowerCase());
                }
              }
              // Check for region matches
              if (region && region.includes(searchLower)) {
                if (!regionMatches.has(row.region)) {
                  regionMatches.set(row.region, new Set<string>());
                }
                if (row.gene) {
                  regionMatches.get(row.region)!.add(row.gene);
                  matchedGenes.add(row.gene.toLowerCase());
                }
              }
            });
          }
        } catch (err) {
          console.error('Failed to load supplemental colocal data', err);
        }

        // Add variant results from coloc_supplement with their associated genes
        let colocResultCounter = 0;
        variantMatches.forEach((genes, variant) => {
          genes.forEach((gene) => {
            colocResultCounter++;
            foundResults.push({
              id: `variant-coloc-${colocResultCounter}`,
              type: 'variant',
              name: variant,
              description: `Colocalized with gene: ${gene}`,
              details: `Coloc Gene: ${gene}`,
              link: '/gene-metabolite',
              isGIMRelevant: true,
              matchFields: [variant],
              colocGene: gene
            });
          });
        });

        // Add region results from coloc_supplement with their associated genes
        regionMatches.forEach((genes, region) => {
          genes.forEach((gene) => {
            colocResultCounter++;
            foundResults.push({
              id: `region-coloc-${colocResultCounter}`,
              type: 'region',
              name: region,
              description: `Colocalized with gene: ${gene}`,
              details: `Coloc Gene: ${gene}`,
              link: '/csl-loci',
              isGIMRelevant: true,
              matchFields: [region],
              colocGene: gene
            });
          });
        });

        setResults(foundResults);
        const matchedGeneList = Array.from(matchedGenes);
        const hasNetworkGeneHit = matchedGeneList.some((g) =>
          networkGenesLocal.has(g)
        );
        const hasSupplementVariantRegionHit = (variantMatches.size > 0) || (regionMatches.size > 0);
        const hasNetworkAny = hasNetworkGeneHit || hasSupplementVariantRegionHit;
        setHasNetworkMatch(hasNetworkAny);
        const hasGeneVariantRegion = foundResults.some(
          (r) => r.type === 'gene' || r.type === 'variant' || r.type === 'region'
        );
        setPreferColocNetwork(hasGeneVariantRegion || hasSupplementVariantRegionHit);
        setNetworkTraits(networkTraitsLocal);
        setNetworkGenes(networkGenesLocal);
        
        // Determine preferred coloc gene: prioritize genes from variant/region matches
        let preferredGene = '';
        if (hasSupplementVariantRegionHit) {
          // Get the first gene from the first variant/region match
          for (const genes of variantMatches.values()) {
            if (genes.size > 0) {
              preferredGene = Array.from(genes)[0];
              break;
            }
          }
          if (!preferredGene) {
            for (const genes of regionMatches.values()) {
              if (genes.size > 0) {
                preferredGene = Array.from(genes)[0];
                break;
              }
            }
          }
        } else if (hasNetworkGeneHit) {
          const firstHit = matchedGeneList.find((g) => networkGenesLocal.has(g));
          if (firstHit) preferredGene = firstHit;
        }
        setPreferredColocGene(preferredGene);
        const [gcGimResponse, lesionResponse] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/gc_gim_heatmap.json`),
          fetch(`${import.meta.env.BASE_URL}data/lesion_progression_heatmap.json`)
        ]);
        const gcGimData = await gcGimResponse.json();
        const lesionData = await lesionResponse.json();
        const gcGimMatch =
          gcGimData?.data?.some((row: any) =>
            ['gene', 'Metabolite', 'Biomarker', 'Exposure', 'ID'].some((field) =>
              matchesSearchTerm(row[field])
            )
          ) ?? false;
        const lesionMatch =
          lesionData?.data?.some(
            (row: any) =>
              matchesSearchTerm(row.gene) ||
              matchesSearchTerm(row.metabolic_trait)
          ) ?? false;
        setHasGcGimMatch(gcGimMatch);
        setHasLesionMatch(lesionMatch);
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
  }, [initialQuery, navigate]);

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

  // Filter results based on search query
  const filteredResults = results.filter((result) => {
    const matchesFilter =
      filterQuery === '' ||
      result.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      result.description?.toLowerCase().includes(filterQuery.toLowerCase()) ||
      result.details?.toLowerCase().includes(filterQuery.toLowerCase());

    const matchesType =
      selectedType === 'all' || result.type === selectedType;

    return matchesFilter && matchesType;
  });

  // Group results by type
  const groupedResults = filteredResults.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    },
    {} as Record<string, SearchResult[]>
  );

  const typeOrder: Array<'gene' | 'trait' | 'variant' | 'region'> = [
    'gene',
    'trait',
    'variant',
    'region'
  ];
  const sortedTypes = typeOrder.filter((t) => t in groupedResults);

  const handleResultClick = (result: SearchResult) => {
    if (!result.link) return;
    
    // If result has a specific coloc gene (from variant/region coloc_supplement match)
    if (result.colocGene) {
      if (result.type === 'region' || result.type === 'variant') {
        // For region/variant from coloc_supplement, navigate to coloc network
        navigate(`/gene-metabolite?q=${encodeURIComponent(result.colocGene)}&network=coloc`);
        return;
      }
    }
    
    if (result.link === '/gene-metabolite') {
      const traitLower = result.name.toLowerCase();
      const preferColoc = preferColocNetwork || networkTraits.has(traitLower);
      const targetNetwork = preferColoc ? 'coloc' : 'ggm';
      navigate(`${result.link}?q=${encodeURIComponent(initialQuery)}&network=${targetNetwork}`);
      return;
    }
    if (
      hasNetworkMatch &&
      (result.type === 'gene' || result.type === 'variant' || result.type === 'region')
    ) {
      const geneTarget = preferredColocGene || initialQuery;
      navigate(`/gene-metabolite?q=${encodeURIComponent(geneTarget)}&network=coloc`);
      return;
    }
    navigate(`${result.link}?q=${encodeURIComponent(initialQuery)}`);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900">Search Results</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition flex items-center gap-2"
          >
            ← Back to Search
          </button>
        </div>
        <p className="text-lg text-gray-600">
          Search for: <span className="font-semibold text-gray-900">"{initialQuery}"</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Found {results.length} result{results.length !== 1 ? 's' : ''} across{' '}
          {typeOrder.filter((t) => results.some((r) => r.type === t)).length} categor
          {typeOrder.filter((t) => results.some((r) => r.type === t)).length === 1 ? 'y' : 'ies'}
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
          <p className="text-gray-600 text-lg mb-4">No results found for "{initialQuery}"</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to homepage
          </button>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="mb-6 space-y-4">
            {/* Keyword Filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Filter results within this page..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-4 h-4 text-gray-500" />
              <button
                onClick={() => setSelectedType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedType === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({filteredResults.length})
              </button>
              {typeOrder.map((type) => {
                const count = results.filter((r) => r.type === type).length;
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

          {/* Related resources (GIM & Network) */}
          {(hasGcGimMatch || hasLesionMatch || hasNetworkMatch) && (
            <div className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Related GIM & Regulatory Network Resources
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Your search results are tied to genetically influenced metabotypes. Explore the following pages:
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {hasGcGimMatch && (
                  <button
                    onClick={() => navigate(`/gc-gims`)}
                    className="flex items-center justify-between p-4 bg-green-100 hover:bg-green-200 rounded-lg transition border border-green-300"
                  >
                    <span className="font-semibold text-green-900">
                      GIMs - Gastric Cancer
                    </span>
                    <ChevronRight className="w-5 h-5 text-green-600" />
                  </button>
                )}
                {hasLesionMatch && (
                  <button
                    onClick={() => navigate(`/lesion-progression`)}
                    className="flex items-center justify-between p-4 bg-blue-100 hover:bg-blue-200 rounded-lg transition border border-blue-300"
                  >
                    <span className="font-semibold text-blue-900">
                      GIMs - Gastric Lesion Progression
                    </span>
                    <ChevronRight className="w-5 h-5 text-blue-600" />
                  </button>
                )}
                {hasNetworkMatch && (
                  <button
                    onClick={() =>
                      navigate(
                        `/gene-metabolite?network=coloc`
                      )
                    }
                    className="flex items-center justify-between p-4 bg-purple-100 hover:bg-purple-200 rounded-lg transition border border-purple-300"
                  >
                    <span className="font-semibold text-purple-900">
                      Regulatory Network
                    </span>
                    <ChevronRight className="w-5 h-5 text-purple-600" />
                  </button>
                )}
              </div>
            </div>
          )}
          </div>

          {/* Results by Category */}
          {filteredResults.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600">No results match your filter</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedTypes.map((type) => {
                const typeResults = groupedResults[type] || [];
                if (typeResults.length === 0) return null;

                const colors = getTypeColor(type);
                return (
                  <div
                    key={type}
                    className={`rounded-lg border-2 ${colors.border} overflow-hidden`}
                  >
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
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${colors.badge}`}
                              >
                                {getTypeLabel(result.type)}
                              </span>
                              <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition">
                                {result.name}
                              </h3>
                              {result.isGIMRelevant && (
                                <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                                  GIM-Related
                                </span>
                              )}
                            </div>
                            {result.description && (
                              <p className="text-gray-600 text-sm mb-1">
                                {result.description}
                              </p>
                            )}
                            {result.details && (
                              <p className="text-gray-500 text-xs">{result.details}</p>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <ExternalLink
                              className={`w-5 h-5 ${colors.icon} opacity-0 group-hover:opacity-100 transition`}
                            />
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-600 transition" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchResultsPage;


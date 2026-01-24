import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
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
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const examples = [
    { type: 'Gene', example: 'ABCA1' },
    { type: 'Metabolite', example: 'LDL_C' },
    { type: 'Variant', example: 'rs1800978' },
    { type: 'Region', example: 'chr9' }
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length === 0) {
      toast.error('Please enter a search query');
      return;
    }

    setIsSearching(true);
    try {
      // Navigate to search results page with query
      navigate(`/search-results?q=${encodeURIComponent(query)}`);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to perform search');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="w-full">
        <div className="relative flex items-center bg-white/10 backdrop-blur-md rounded-lg shadow-lg overflow-hidden border border-white/20 hover:border-white/40 transition hover:bg-white/15">
          <Search className="w-5 h-5 text-white/70 ml-4 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search genes, traits, variants, or regions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-3 outline-none text-white placeholder-white/60 bg-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="pr-4 text-white/50 hover:text-white/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white font-medium transition disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Examples Guide */}
      <div className="text-center">
        <p className="text-white/60 text-xs mb-2">Examples:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {examples.map((ex, idx) => (
            <button
              key={idx}
              onClick={() => setQuery(ex.example)}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded border border-white/20 text-white text-xs transition hover:text-white/90"
              title={`Search for ${ex.type}`}
            >
              <span className="text-white/60">{ex.type}:</span>{' '}
              <span className="font-semibold">{ex.example}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;


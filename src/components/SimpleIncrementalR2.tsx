import React, { useState, useMemo } from 'react';
import { BarChart3, Search, Download } from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface SimpleR2Data {
  metabolic_trait: string;
  gim_r2: number;
  other_r2: number;
  total_r2: number;
  is_gim_trait: boolean;
}

interface SimpleIncrementalR2Props {
  data: SimpleR2Data[];
}

const SimpleIncrementalR2: React.FC<SimpleIncrementalR2Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyGIM, setShowOnlyGIM] = useState(false);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = data.filter(trait => 
      trait.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (showOnlyGIM) {
      filtered = filtered.filter(trait => trait.is_gim_trait);
    }
    
    return filtered.sort((a, b) => b.gim_r2 - a.gim_r2);
  }, [data, searchTerm, showOnlyGIM]);

  const maxR2 = Math.max(...data.map(d => d.total_r2));

  const exportData = () => {
    const csvData = filteredData.map(trait => ({
      'Metabolic Trait': trait.metabolic_trait,
      'GIM R²': trait.gim_r2.toFixed(4),
      'Other Determinants R²': trait.other_r2.toFixed(4),
      'Total R²': trait.total_r2.toFixed(4),
      'Is GIM Trait': trait.is_gim_trait ? 'Yes' : 'No'
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incremental_r2_gim_comparison.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search metabolic traits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <button
            onClick={() => setShowOnlyGIM(!showOnlyGIM)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              showOnlyGIM 
                ? 'bg-blue-500 text-white border-blue-500' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {showOnlyGIM ? 'Show All Traits' : 'Show Only GIM Traits'}
          </button>
        </div>
        
        <button
          onClick={exportData}
          className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Total Traits</h3>
          <p className="text-2xl font-bold text-gray-900">{filteredData.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">GIM Traits</h3>
          <p className="text-2xl font-bold text-blue-600">
            {filteredData.filter(d => d.is_gim_trait).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Avg GIM R²</h3>
          <p className="text-2xl font-bold text-green-600">
            {(filteredData.reduce((sum, d) => sum + d.gim_r2, 0) / filteredData.length).toFixed(3)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Avg Other R²</h3>
          <p className="text-2xl font-bold text-orange-600">
            {(filteredData.reduce((sum, d) => sum + d.other_r2, 0) / filteredData.length).toFixed(3)}
          </p>
        </div>
      </div>

      {/* Visualization */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          GIM R² vs Other Determinants
        </h3>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredData.slice(0, 50).map((trait, index) => (
            <div key={trait.metabolic_trait} className="flex items-center space-x-3">
              <div className="w-32 text-sm font-medium truncate" title={trait.metabolic_trait}>
                {trait.metabolic_trait}
              </div>
              
              {trait.is_gim_trait && (
                <Badge variant="secondary" className="text-xs">GIM</Badge>
              )}
              
              <div className="flex-1 flex items-center space-x-2">
                {/* GIM R² bar */}
                <div className="flex-1 relative">
                  <div className="h-6 bg-gray-100 rounded">
                    <div 
                      className="h-full bg-blue-500 rounded flex items-center justify-end pr-2"
                      style={{ width: `${(trait.gim_r2 / maxR2) * 100}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        {trait.gim_r2.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">GIM</div>
                </div>
                
                {/* Other R² bar */}
                <div className="flex-1 relative">
                  <div className="h-6 bg-gray-100 rounded">
                    <div 
                      className="h-full bg-orange-500 rounded flex items-center justify-end pr-2"
                      style={{ width: `${(trait.other_r2 / maxR2) * 100}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        {trait.other_r2.toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Others</div>
                </div>
              </div>
              
              <div className="w-16 text-sm text-right font-medium">
                {trait.total_r2.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
        
        {filteredData.length > 50 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Showing top 50 of {filteredData.length} traits. Use search to filter further.
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleIncrementalR2;

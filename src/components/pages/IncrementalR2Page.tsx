import React, { useState, useEffect } from 'react';
import { BarChart3, Info } from 'lucide-react';
import SimpleIncrementalR2 from '../SimpleIncrementalR2';
import toast from 'react-hot-toast';

interface SimpleR2Data {
  metabolic_trait: string;
  gim_r2: number;
  other_r2: number;
  total_r2: number;
  is_gim_trait: boolean;
}

interface SimpleR2Dataset {
  title: string;
  description: string;
  data: SimpleR2Data[];
}

const IncrementalR2Page: React.FC = () => {
  const [data, setData] = useState<SimpleR2Dataset | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/simple_incremental_r2.json`);
        const r2Data = await response.json();
        setData(r2Data);
      } catch (error) {
        console.error('Error loading incremental R² data:', error);
        toast.error('Failed to load incremental R² data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-2">Failed to load incremental R² data</div>
        <div className="text-gray-500">Please try refreshing the page</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-8 w-8 text-purple-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Incremental R² Analysis</h1>
            <p className="text-gray-600 mt-1">
              GIM R² compared to other determinants for metabolic traits
            </p>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">About Incremental R²</h3>
            <p className="text-sm text-blue-700 mt-1">
              This analysis compares the incremental R² contribution of GIM (Genetically Influenced Metabotypes) 
              versus other determinants (age, sex, ethnicity, BMI, smoking, etc.) in predicting metabolic trait levels. 
              Higher GIM R² indicates stronger genetic influence on the trait.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900">Total Traits</h3>
          <p className="text-3xl font-bold text-blue-600">{data.data.length}</p>
          <p className="text-sm text-gray-500 mt-1">Metabolic traits analyzed</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900">GIM Traits</h3>
          <p className="text-3xl font-bold text-green-600">
            {data.data.filter(d => d.is_gim_trait).length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Traits with genetic influence</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900">Avg GIM R²</h3>
          <p className="text-3xl font-bold text-purple-600">
            {(data.data.reduce((sum, d) => sum + d.gim_r2, 0) / data.data.length).toFixed(3)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Average genetic contribution</p>
        </div>
      </div>

      {/* Main Visualization */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <SimpleIncrementalR2 data={data.data} />
        </div>
      </div>
    </div>
  );
};

export default IncrementalR2Page;

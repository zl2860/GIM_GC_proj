import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Loader2, Download, Search, Filter } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface GCGimData {
  gene: string;
  Biomarker?: string;
  metabolic_trait?: string;
  'value.update'?: string;
  functional_role?: string;
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
  is_causal: string | boolean;
}

interface RobustGCGimHeatmapProps {
  data: GCGimData[];
  onAssociationClick?: (association: GCGimData) => void;
}

const RobustGCGimHeatmap: React.FC<RobustGCGimHeatmapProps> = ({ 
  data, 
  onAssociationClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGene, setSelectedGene] = useState<string>('all');
  const [selectedMetabolite, setSelectedMetabolite] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Process data to extract unique genes and metabolites
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return { genes: [], metabolites: [], filteredData: [] };

    const genes = Array.from(new Set(data.map(d => d.gene))).sort();
    const metabolites = Array.from(new Set(data.map(d => {
      return d.Biomarker || d.metabolic_trait || d.Metabolite || 'Unknown';
    }))).filter(m => m && m !== 'Unknown').sort();

    // Filter data based on search and selections
    let filteredData = data.filter(d => {
      const geneMatch = selectedGene === 'all' || d.gene === selectedGene;
      const metaboliteKey = d.Biomarker || d.metabolic_trait || d.Metabolite;
      const metaboliteMatch = selectedMetabolite === 'all' || metaboliteKey === selectedMetabolite;
      const searchMatch = searchTerm === '' || 
        d.gene.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (metaboliteKey && metaboliteKey.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return geneMatch && metaboliteMatch && searchMatch;
    });

    return { genes, metabolites, filteredData };
  }, [data, searchTerm, selectedGene, selectedMetabolite]);

  const renderHeatmap = React.useCallback(() => {
    if (!svgRef.current || !processedData.filteredData.length) return;

    setIsRendering(true);
    setError(null);

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const margin = { top: 80, right: 120, bottom: 80, left: 120 };
      const width = 900 - margin.left - margin.right;
      const height = 600 - margin.bottom - margin.top;

      const g = svg
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.bottom + margin.top)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Create matrix data
      const genes = Array.from(new Set(processedData.filteredData.map(d => d.gene))).sort();
      const metabolites = Array.from(new Set(processedData.filteredData.map(d => {
        return d.Biomarker || d.metabolic_trait || d.Metabolite;
      }))).filter(Boolean).sort();

      const matrixData: Array<{
        gene: string;
        metabolite: string;
        value: number;
        pValue: number;
        data: GCGimData;
      }> = [];

      genes.forEach(gene => {
        metabolites.forEach(metabolite => {
          const match = processedData.filteredData.find(d => {
            const metKey = d.Biomarker || d.metabolic_trait || d.Metabolite;
            return d.gene === gene && metKey === metabolite;
          });
          
          if (match) {
            matrixData.push({
              gene,
              metabolite,
              value: match['Beta.MR'] || match['Beta.pred'] || 0,
              pValue: match.P_value || 1,
              data: match
            });
          }
        });
      });

      if (matrixData.length === 0) {
        g.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("fill", "#666")
          .text("No data matches current filters");
        setIsRendering(false);
        return;
      }

      // Scales
      const xScale = d3.scaleBand()
        .domain(metabolites)
        .range([0, width])
        .padding(0.1);

      const yScale = d3.scaleBand()
        .domain(genes)
        .range([0, height])
        .padding(0.1);

      const colorScale = d3.scaleSequential(d3.interpolateRdBu)
        .domain(d3.extent(matrixData, d => d.value).reverse() as [number, number]);

      const sizeScale = d3.scaleLinear()
        .domain(d3.extent(matrixData, d => -Math.log10(d.pValue)) as [number, number])
        .range([2, Math.min(xScale.bandwidth(), yScale.bandwidth()) - 2]);

      // Create tooltip
      const tooltip = d3.select("body").selectAll(".heatmap-tooltip")
        .data([0])
        .join("div")
        .attr("class", "heatmap-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000);

      // Draw heatmap rectangles
      g.selectAll(".heatmap-rect")
        .data(matrixData)
        .join("rect")
        .attr("class", "heatmap-rect")
        .attr("x", d => xScale(d.metabolite) || 0)
        .attr("y", d => yScale(d.gene) || 0)
        .attr("width", d => sizeScale(-Math.log10(d.pValue)))
        .attr("height", d => sizeScale(-Math.log10(d.pValue)))
        .attr("rx", 2)
        .style("fill", d => colorScale(d.value))
        .style("stroke", "#fff")
        .style("stroke-width", 0.5)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
          tooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.gene} - ${d.metabolite}</strong><br/>
              Beta: ${d.value.toFixed(3)}<br/>
              P-value: ${d.pValue.toExponential(2)}<br/>
              -log10(p): ${(-Math.log10(d.pValue)).toFixed(2)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
          if (onAssociationClick) {
            onAssociationClick(d.data);
          }
        });

      // X-axis
      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)")
        .style("font-size", "10px");

      // Y-axis
      g.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "10px");

      // Title
      g.append("text")
        .attr("x", width / 2)
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(`Gene-Metabolite Associations (${matrixData.length} associations)`);

      // Color legend
      const legendWidth = 200;
      const legendHeight = 10;
      
      const legend = g.append("g")
        .attr("transform", `translate(${width - legendWidth}, -30)`);

      const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendWidth]);

      const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format(".2f"));

      legend.selectAll(".legend-rect")
        .data(d3.range(legendWidth))
        .join("rect")
        .attr("class", "legend-rect")
        .attr("x", d => d)
        .attr("y", 0)
        .attr("width", 1)
        .attr("height", legendHeight)
        .style("fill", d => colorScale(legendScale.invert(d)));

      legend.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "10px");

      legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Beta Coefficient");

    } catch (err) {
      console.error('Error rendering heatmap:', err);
      setError('Failed to render heatmap visualization');
    } finally {
      setIsRendering(false);
    }
  }, [processedData, onAssociationClick]);

  useEffect(() => {
    renderHeatmap();
  }, [renderHeatmap]);

  const exportData = () => {
    const csvData = processedData.filteredData.map(d => ({
      Gene: d.gene,
      Metabolite: d.Biomarker || d.metabolic_trait || d.Metabolite,
      'Beta Coefficient': d['Beta.MR'] || d['Beta.pred'],
      'P-value': d.P_value,
      'Lower CI': d['Beta.MR.lower'] || d['Beta.pred.lower'],
      'Upper CI': d['Beta.MR.upper'] || d['Beta.pred.upper'],
      'Is Causal': d.is_causal
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gc_gim_associations.csv';
    a.click();
  };

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-700 font-medium">Visualization Error</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
        <button 
          onClick={renderHeatmap}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry Rendering
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search genes or metabolites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Select value={selectedGene} onValueChange={setSelectedGene}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select gene" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genes</SelectItem>
              {processedData.genes.map(gene => (
                <SelectItem key={gene} value={gene}>{gene}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedMetabolite} onValueChange={setSelectedMetabolite}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select metabolite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metabolites</SelectItem>
              {processedData.metabolites.map(metabolite => (
                <SelectItem key={metabolite} value={metabolite}>{metabolite}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <button
          onClick={exportData}
          className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Total Associations</h3>
          <p className="text-2xl font-bold text-gray-900">{processedData.filteredData.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Unique Genes</h3>
          <p className="text-2xl font-bold text-blue-600">{processedData.genes.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Unique Metabolites</h3>
          <p className="text-2xl font-bold text-green-600">{processedData.metabolites.length}</p>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="relative">
          {isRendering && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}
          <svg ref={svgRef}></svg>
        </div>
      </div>
    </div>
  );
};

export default RobustGCGimHeatmap;

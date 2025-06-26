import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Loader2, Download, Search, BarChart3 } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface RiskData {
  metabolic_trait: string;
  ukbb_measured?: number | null;
  ukbb_predicted?: number | null;
  sit_predicted?: number | null;
  mits_predicted?: number | null;
  ugced_predicted?: number | null;
  [key: string]: string | number | null | undefined;
}

interface SimpleRiskScatterPlotProps {
  data: RiskData[];
  onTraitClick?: (trait: RiskData) => void;
}

const SimpleRiskScatterPlot: React.FC<SimpleRiskScatterPlotProps> = ({ 
  data, 
  onTraitClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Process data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { cohorts: [], plotData: [] };

    // Filter valid data
    const validData = data.filter(d => 
      d.metabolic_trait && 
      typeof d.metabolic_trait === 'string' &&
      d.metabolic_trait !== 'Biomarker' &&
      d.metabolic_trait !== 'metabolic_trait'
    );

    // Get cohort columns
    const cohorts = Object.keys(validData[0] || {})
      .filter(key => key !== 'metabolic_trait' && (key.includes('predicted') || key.includes('measured')))
      .sort();

    // Apply search filter
    const filteredData = validData.filter(d =>
      d.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Convert to plot points
    const plotData = filteredData.flatMap((trait, traitIndex) => {
      return cohorts.map((cohort, cohortIndex) => {
        const value = trait[cohort] as number | null;
        if (value !== null && value !== undefined && !isNaN(value)) {
          return {
            trait: trait.metabolic_trait,
            cohort: cohort,
            value: value,
            x: traitIndex,
            y: value,
            rawData: trait
          };
        }
        return null;
      }).filter(Boolean);
    }).filter(Boolean) as Array<{
      trait: string;
      cohort: string;
      value: number;
      x: number;
      y: number;
      rawData: RiskData;
    }>;

    return { cohorts, plotData };
  }, [data, searchTerm]);

  const renderChart = React.useCallback(() => {
    if (!svgRef.current || processedData.plotData.length === 0) return;

    setIsRendering(true);
    setError(null);

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const margin = { top: 40, right: 150, bottom: 60, left: 60 };
      const width = 800 - margin.left - margin.right;
      const height = 500 - margin.bottom - margin.top;

      svg
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.bottom + margin.top);

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Filter by cohort if selected
      let plotData = processedData.plotData;
      if (selectedCohort !== 'all') {
        plotData = plotData.filter(d => d.cohort === selectedCohort);
      }

      if (plotData.length === 0) {
        g.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("fill", "#666")
          .text("No data available");
        setIsRendering(false);
        return;
      }

      // Scales
      const xExtent = d3.extent(plotData, d => d.x) as [number, number];
      const yExtent = d3.extent(plotData, d => d.y) as [number, number];
      
      const xScale = d3.scaleLinear()
        .domain([xExtent[0] - 0.5, xExtent[1] + 0.5])
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain([yExtent[0] - 0.1, yExtent[1] + 0.1])
        .range([height, 0]);

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(processedData.cohorts);

      // Add gridlines
      g.selectAll(".grid-line-x")
        .data(xScale.ticks())
        .join("line")
        .attr("class", "grid-line-x")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", height)
        .style("stroke", "#f0f0f0")
        .style("stroke-width", 0.5);

      g.selectAll(".grid-line-y")
        .data(yScale.ticks())
        .join("line")
        .attr("class", "grid-line-y")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .style("stroke", "#f0f0f0")
        .style("stroke-width", 0.5);

      // Zero line
      if (yExtent[0] <= 0 && yExtent[1] >= 0) {
        g.append("line")
          .attr("x1", 0)
          .attr("x2", width)
          .attr("y1", yScale(0))
          .attr("y2", yScale(0))
          .style("stroke", "#999")
          .style("stroke-width", 2)
          .style("stroke-dasharray", "5,5");
      }

      // Create tooltip
      const tooltip = d3.select("body")
        .selectAll(".simple-risk-tooltip")
        .data([0])
        .join("div")
        .attr("class", "simple-risk-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000);

      // Draw points
      g.selectAll(".risk-point")
        .data(plotData)
        .join("circle")
        .attr("class", "risk-point")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 4)
        .style("fill", d => colorScale(d.cohort))
        .style("stroke", "white")
        .style("stroke-width", 1)
        .style("opacity", 0.7)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
          d3.select(this).attr("r", 6).style("opacity", 1);
          tooltip
            .style("opacity", 1)
            .html(`
              <strong>${d.trait}</strong><br/>
              Cohort: ${d.cohort}<br/>
              Log(RR): ${d.value.toFixed(3)}<br/>
              ${d.value > 0 ? 'Increased risk' : 'Decreased risk'}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("r", 4).style("opacity", 0.7);
          tooltip.style("opacity", 0);
        })
        .on("click", function(event, d) {
          if (onTraitClick) {
            onTraitClick(d.rawData);
          }
        });

      // Axes
      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(() => ""))
        .selectAll("text")
        .style("font-size", "10px");

      g.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "10px");

      // Axis labels
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Log(RR)");

      g.append("text")
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Metabolic Traits");

      // Title
      g.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(`Risk Associations${selectedCohort !== 'all' ? ` - ${selectedCohort}` : ''}`);

      // Legend
      const legend = g.append("g")
        .attr("transform", `translate(${width + 20}, 20)`);

      const cohorts = selectedCohort === 'all' 
        ? processedData.cohorts 
        : [selectedCohort];

      legend.selectAll(".legend-item")
        .data(cohorts)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`)
        .each(function(d) {
          const item = d3.select(this);
          
          item.append("circle")
            .attr("r", 4)
            .style("fill", colorScale(d));
          
          item.append("text")
            .attr("x", 10)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .style("font-size", "10px")
            .text(d.replace(/_/g, ' '));
        });

    } catch (err) {
      console.error('Error rendering risk chart:', err);
      setError('Failed to render chart');
    } finally {
      setIsRendering(false);
    }
  }, [processedData, selectedCohort, onTraitClick]);

  useEffect(() => {
    renderChart();
  }, [renderChart]);

  const exportData = () => {
    const csv = processedData.plotData.map(d => 
      `${d.trait},${d.cohort},${d.value}`
    ).join('\n');
    
    const blob = new Blob([`Trait,Cohort,LogRR\n${csv}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'risk_associations.csv';
    a.click();
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <div className="text-red-700 font-medium">Visualization Error</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
        <button 
          onClick={renderChart}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search traits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-48"
          />
        </div>
        
        <Select value={selectedCohort} onValueChange={setSelectedCohort}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cohorts</SelectItem>
            {processedData.cohorts.map(cohort => (
              <SelectItem key={cohort} value={cohort}>{cohort}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <button
          onClick={exportData}
          className="flex items-center space-x-2 px-3 py-2 bg-green-500 text-white rounded text-sm"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Chart */}
      <div className="bg-white p-4 rounded border relative">
        {isRendering && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}
        <svg ref={svgRef}></svg>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600">
        Showing {processedData.plotData.length} risk associations across {new Set(processedData.plotData.map(d => d.trait)).size} traits
      </div>
    </div>
  );
};

export default SimpleRiskScatterPlot;

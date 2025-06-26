import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Loader2, Download, Search, BarChart3, TrendingUp, Filter } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';

interface RiskComparisonData {
  metabolic_trait: string;
  ukbb_measured?: number | null;
  ukbb_predicted?: number | null;
  sit_predicted?: number | null;
  mits_predicted?: number | null;
  fphs_predicted?: number | null;
  ugced_predicted?: number | null;
  [key: string]: string | number | null | undefined;
}

interface RobustRiskComparisonChartProps {
  data: RiskComparisonData[];
  onTraitClick?: (trait: RiskComparisonData) => void;
}

const RobustRiskComparisonChart: React.FC<RobustRiskComparisonChartProps> = ({ 
  data, 
  onTraitClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'scatter' | 'bar' | 'comparison'>('scatter');
  const [error, setError] = useState<string | null>(null);

  // Process data and extract cohorts
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { cohorts: [], validData: [], chartData: [] };

    // Filter out invalid entries (like header rows)
    const validData = data.filter(d => 
      d.metabolic_trait && 
      d.metabolic_trait !== 'Biomarker' && 
      d.metabolic_trait !== 'metabolic_trait' &&
      typeof d.metabolic_trait === 'string'
    );

    // Extract cohort names from data keys
    const cohorts = Object.keys(validData[0] || {})
      .filter(key => key !== 'metabolic_trait' && key.includes('predicted') || key.includes('measured'))
      .sort();

    // Apply search filter
    const filteredData = validData.filter(d =>
      d.metabolic_trait.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Convert to chart data format
    const chartData = filteredData.flatMap(trait => {
      return cohorts.map(cohort => ({
        trait: trait.metabolic_trait,
        cohort: cohort,
        value: trait[cohort] as number | null,
        hasValue: trait[cohort] !== null && trait[cohort] !== undefined && !isNaN(trait[cohort] as number),
        rawData: trait
      }));
    }).filter(d => d.hasValue && d.value !== null);

    return { cohorts, validData: filteredData, chartData };
  }, [data, searchTerm]);

  const renderVisualization = React.useCallback(() => {
    if (!svgRef.current || processedData.chartData.length === 0) return;

    setIsRendering(true);
    setError(null);

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const margin = { top: 60, right: 150, bottom: 80, left: 80 };
      const width = 900 - margin.left - margin.right;
      const height = 600 - margin.bottom - margin.top;

      svg
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.bottom + margin.top);

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Filter data by selected cohort
      let plotData = processedData.chartData;
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
          .text("No data available for current selection");
        setIsRendering(false);
        return;
      }

      // Color scale for cohorts
      const colorScale = d3.scaleOrdinal(d3.schemeSet2)
        .domain(processedData.cohorts);

      // Create tooltip
      const tooltip = d3.select("body").selectAll(".risk-comparison-tooltip")
        .data([0])
        .join("div")
        .attr("class", "risk-comparison-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.9)")
        .style("color", "white")
        .style("padding", "10px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 1000)
        .style("max-width", "250px");

      if (viewMode === 'scatter') {
        // Scatter plot visualization
        const xScale = d3.scaleLinear()
          .domain(d3.extent(plotData, d => d.value) as [number, number])
          .range([0, width]);

        const yScale = d3.scaleBand()
          .domain(Array.from(new Set(plotData.map(d => d.trait))).sort())
          .range([0, height])
          .padding(0.1);

        // X-axis
        g.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(d3.axisBottom(xScale).tickFormat(d3.format(".2f")))
          .selectAll("text")
          .style("font-size", "10px");

        // Y-axis
        g.append("g")
          .call(d3.axisLeft(yScale))
          .selectAll("text")
          .style("font-size", "9px");

        // Add gridlines
        g.selectAll(".grid-line")
          .data(xScale.ticks())
          .join("line")
          .attr("class", "grid-line")
          .attr("x1", d => xScale(d))
          .attr("x2", d => xScale(d))
          .attr("y1", 0)
          .attr("y2", height)
          .style("stroke", "#f0f0f0")
          .style("stroke-width", 0.5);

        // Add vertical line at x=0 if domain includes 0
        const xDomain = xScale.domain();
        if (xDomain[0] <= 0 && xDomain[1] >= 0) {
          g.append("line")
            .attr("x1", xScale(0))
            .attr("x2", xScale(0))
            .attr("y1", 0)
            .attr("y2", height)
            .style("stroke", "#999")
            .style("stroke-width", 1)
            .style("stroke-dasharray", "3,3");
        }

        // Draw points
        g.selectAll(".risk-point")
          .data(plotData)
          .join("circle")
          .attr("class", "risk-point")
          .attr("cx", d => xScale(d.value))
          .attr("cy", d => (yScale(d.trait) || 0) + yScale.bandwidth() / 2)
          .attr("r", 4)
          .style("fill", d => colorScale(d.cohort))
          .style("stroke", "white")
          .style("stroke-width", 1)
          .style("cursor", "pointer")
          .style("opacity", 0.8)
          .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 1).attr("r", 6);
            tooltip
              .style("opacity", 1)
              .html(`
                <strong>${d.trait}</strong><br/>
                Cohort: ${d.cohort}<br/>
                Log(RR): ${d.value.toFixed(3)}<br/>
                ${d.value > 0 ? '↑ Increased risk' : '↓ Decreased risk'}
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function(event, d) {
            d3.select(this).style("opacity", 0.8).attr("r", 4);
            tooltip.style("opacity", 0);
          })
          .on("click", function(event, d) {
            if (onTraitClick) {
              onTraitClick(d.rawData);
            }
          });

      } else if (viewMode === 'bar') {
        // Bar chart visualization
        const traits = Array.from(new Set(plotData.map(d => d.trait))).sort();
        const traitScale = d3.scaleBand()
          .domain(traits)
          .range([0, width])
          .padding(0.1);

        const cohortScale = d3.scaleBand()
          .domain(processedData.cohorts.filter(c => selectedCohort === 'all' || c === selectedCohort))
          .range([0, traitScale.bandwidth()])
          .padding(0.05);

        const valueExtent = d3.extent(plotData, d => d.value) as [number, number];
        const yScale = d3.scaleLinear()
          .domain(valueExtent)
          .range([height, 0]);

        // X-axis
        g.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(d3.axisBottom(traitScale))
          .selectAll("text")
          .style("text-anchor", "end")
          .attr("dx", "-.8em")
          .attr("dy", ".15em")
          .attr("transform", "rotate(-45)")
          .style("font-size", "9px");

        // Y-axis
        g.append("g")
          .call(d3.axisLeft(yScale))
          .selectAll("text")
          .style("font-size", "10px");

        // Zero line
        if (valueExtent[0] <= 0 && valueExtent[1] >= 0) {
          g.append("line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", yScale(0))
            .attr("y2", yScale(0))
            .style("stroke", "#999")
            .style("stroke-width", 1)
            .style("stroke-dasharray", "3,3");
        }

        // Draw bars
        g.selectAll(".risk-bar")
          .data(plotData)
          .join("rect")
          .attr("class", "risk-bar")
          .attr("x", d => (traitScale(d.trait) || 0) + (cohortScale(d.cohort) || 0))
          .attr("y", d => d.value >= 0 ? yScale(d.value) : yScale(0))
          .attr("width", cohortScale.bandwidth())
          .attr("height", d => Math.abs(yScale(d.value) - yScale(0)))
          .style("fill", d => colorScale(d.cohort))
          .style("stroke", "white")
          .style("stroke-width", 0.5)
          .style("cursor", "pointer")
          .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip
              .style("opacity", 1)
              .html(`
                <strong>${d.trait}</strong><br/>
                Cohort: ${d.cohort}<br/>
                Log(RR): ${d.value.toFixed(3)}<br/>
                ${d.value > 0 ? '↑ Increased risk' : '↓ Decreased risk'}
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
            tooltip.style("opacity", 0);
          })
          .on("click", function(event, d) {
            if (onTraitClick) {
              onTraitClick(d.rawData);
            }
          });
      }

      // Title
      g.append("text")
        .attr("x", width / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(`Risk Associations${selectedCohort !== 'all' ? ` - ${selectedCohort}` : ''}`);

      g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text(`${plotData.length} associations across ${new Set(plotData.map(d => d.trait)).size} traits`);

      // Axis labels
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text(viewMode === 'scatter' ? "Metabolic Traits" : "Log(RR)");

      g.append("text")
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text(viewMode === 'scatter' ? "Log(RR)" : "Metabolic Traits");

      // Legend
      const legend = g.append("g")
        .attr("transform", `translate(${width + 20}, 20)`);

      const cohorts = Array.from(new Set(plotData.map(d => d.cohort)));
      
      legend.selectAll(".legend-item")
        .data(cohorts)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`)
        .each(function(d) {
          const item = d3.select(this);
          
          item.append("circle")
            .attr("r", 6)
            .style("fill", colorScale(d));
          
          item.append("text")
            .attr("x", 12)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .style("font-size", "11px")
            .text(d);
        });

    } catch (err) {
      console.error('Error rendering risk comparison chart:', err);
      setError('Failed to render visualization');
    } finally {
      setIsRendering(false);
    }
  }, [processedData, selectedCohort, viewMode, onTraitClick]);

  useEffect(() => {
    renderVisualization();
  }, [renderVisualization]);

  const exportData = () => {
    const exportData = processedData.chartData.map(d => ({
      'Metabolic Trait': d.trait,
      'Cohort': d.cohort,
      'Log(RR)': d.value,
      'Risk Direction': d.value > 0 ? 'Increased' : 'Decreased'
    }));
    
    const csv = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'risk_comparison_chart.csv';
    a.click();
  };

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-700 font-medium">Visualization Error</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
        <button 
          onClick={renderVisualization}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry Rendering
        </button>
      </div>
    );
  }

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
          
          <Select value={selectedCohort} onValueChange={setSelectedCohort}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select cohort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              {processedData.cohorts.map(cohort => (
                <SelectItem key={cohort} value={cohort}>{cohort}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scatter">Scatter</SelectItem>
              <SelectItem value="bar">Bar Chart</SelectItem>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Total Associations</h3>
          <p className="text-2xl font-bold text-gray-900">{processedData.chartData.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Unique Traits</h3>
          <p className="text-2xl font-bold text-blue-600">
            {new Set(processedData.chartData.map(d => d.trait)).size}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Cohorts</h3>
          <p className="text-2xl font-bold text-green-600">{processedData.cohorts.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Risk Increases</h3>
          <p className="text-2xl font-bold text-red-600">
            {processedData.chartData.filter(d => d.value > 0).length}
          </p>
        </div>
      </div>

      {/* Visualization */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="relative overflow-x-auto">
          {isRendering && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600">Rendering visualization...</span>
              </div>
            </div>
          )}
          <svg ref={svgRef}></svg>
        </div>
      </div>
    </div>
  );
};

export default RobustRiskComparisonChart;

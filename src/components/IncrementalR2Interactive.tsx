import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface R2Data {
  metabolic_trait: string;
  determinant: string;
  incremental_r2: number;
  is_gim: boolean;
}

interface IncrementalR2InteractiveProps {
  data: R2Data[];
  selectedDeterminant?: string | null;
  onDeterminantChange?: (determinant: string | null) => void;
  viewMode?: 'bar' | 'scatter' | 'table';
  onViewModeChange?: (mode: 'bar' | 'scatter' | 'table') => void;
}

interface Dimensions {
  width: number;
  height: number;
}

const IncrementalR2Interactive: React.FC<IncrementalR2InteractiveProps> = ({ 
  data, 
  selectedDeterminant,
  onDeterminantChange,
  viewMode = 'bar',
  onViewModeChange
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions] = useState<Dimensions>({ width: 1000, height: 600 });
  const [hoveredData, setHoveredData] = useState<R2Data | null>(null);
  const [sortBy, setSortBy] = useState<'trait' | 'r2'>('r2');

  // Get unique determinants
  const determinants = [...new Set(data.map(d => d.determinant))].sort();
  
  // Filter data by selected determinant
  const filteredData = selectedDeterminant 
    ? data.filter(d => d.determinant === selectedDeterminant)
    : data;

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'r2') {
      return b.incremental_r2 - a.incremental_r2;
    }
    return a.metabolic_trait.localeCompare(b.metabolic_trait);
  });

  useEffect(() => {
    if (!sortedData || sortedData.length === 0 || viewMode === 'table') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 80, right: 150, bottom: 100, left: 200 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Add background
    svg.append("rect")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("fill", "#ffffff");

    // Add title
    const title = selectedDeterminant 
      ? `Incremental R² for ${selectedDeterminant.replace(/_/g, ' ').toUpperCase()}`
      : "Incremental R² Comparison by Determinants";
    
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "600")
      .style("fill", "#111827")
      .text(title);

    // Add subtitle
    const gimCount = sortedData.filter(d => d.is_gim).length;
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#6b7280")
      .text(`${sortedData.length} traits | ${gimCount} GIM traits highlighted`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    if (viewMode === 'bar') {
      // Bar chart visualization
      const yScale = d3.scaleBand()
        .domain(sortedData.map(d => d.metabolic_trait))
        .range([0, height])
        .padding(0.1);

      const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => d.incremental_r2) || 0])
        .range([0, width]);

      // Add x-axis
      const xAxis = d3.axisBottom(xScale)
        .ticks(6)
        .tickFormat(d3.format(".3f"));

      g.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#374151");

      // Add x-axis label
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#374151")
        .text("Incremental R²");

      // Add y-axis (trait names)
      const maxTraits = Math.floor(height / 20); // Limit visible traits
      const displayData = sortedData.slice(0, maxTraits);
      
      const displayYScale = d3.scaleBand()
        .domain(displayData.map(d => d.metabolic_trait))
        .range([0, height])
        .padding(0.1);

      g.selectAll(".trait-label")
        .data(displayData)
        .enter()
        .append("text")
        .attr("class", "trait-label")
        .attr("x", -10)
        .attr("y", d => displayYScale(d.metabolic_trait)! + displayYScale.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "9px")
        .style("fill", "#374151")
        .text(d => d.metabolic_trait.length > 20 ? d.metabolic_trait.substring(0, 17) + '...' : d.metabolic_trait.replace(/_/g, ' '));

      // Create bars
      g.selectAll(".bar")
        .data(displayData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => displayYScale(d.metabolic_trait)!)
        .attr("width", d => xScale(d.incremental_r2))
        .attr("height", displayYScale.bandwidth())
        .attr("fill", d => d.is_gim ? "#3b82f6" : "#6b7280")
        .style("cursor", "pointer")
        .style("opacity", 0.8)
        .on("mouseover", function(event, d) {
          d3.select(this).style("opacity", 1);
          setHoveredData(d);
        })
        .on("mouseout", function() {
          d3.select(this).style("opacity", 0.8);
          setHoveredData(null);
        });

    } else if (viewMode === 'scatter') {
      // Scatter plot visualization
      const traits = [...new Set(sortedData.map(d => d.metabolic_trait))];
      const determinantData = determinants.map(det => ({
        determinant: det,
        values: traits.map(trait => {
          const item = data.find(d => d.metabolic_trait === trait && d.determinant === det);
          return {
            trait,
            r2: item ? item.incremental_r2 : 0,
            is_gim: item ? item.is_gim : false
          };
        })
      }));

      const xScale = d3.scalePoint()
        .domain(determinants)
        .range([0, width])
        .padding(0.1);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.incremental_r2) || 0])
        .range([height, 0]);

      // Add axes
      const xAxis = d3.axisBottom(xScale);
      const yAxis = d3.axisLeft(yScale)
        .ticks(6)
        .tickFormat(d3.format(".3f"));

      g.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#374151")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

      g.append("g")
        .call(yAxis)
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#374151");

      // Add axis labels
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 60)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#374151")
        .text("Determinants");

      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "#374151")
        .text("Incremental R²");

      // Create scatter points
      data.forEach(d => {
        g.append("circle")
          .attr("cx", xScale(d.determinant)!)
          .attr("cy", yScale(d.incremental_r2))
          .attr("r", 3)
          .attr("fill", d.is_gim ? "#3b82f6" : "#6b7280")
          .style("opacity", 0.7)
          .style("cursor", "pointer")
          .on("mouseover", function(event) {
            d3.select(this).attr("r", 5).style("opacity", 1);
            setHoveredData(d);
          })
          .on("mouseout", function() {
            d3.select(this).attr("r", 3).style("opacity", 0.7);
            setHoveredData(null);
          });
      });
    }

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${dimensions.width - 140}, ${margin.top})`);

    legend.append("text")
      .attr("x", 0)
      .attr("y", 0)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "#374151")
      .text("Legend");

    legend.append("circle")
      .attr("cx", 8)
      .attr("cy", 20)
      .attr("r", 4)
      .attr("fill", "#3b82f6");

    legend.append("text")
      .attr("x", 18)
      .attr("y", 24)
      .style("font-size", "10px")
      .style("fill", "#374151")
      .text("GIM Traits");

    legend.append("circle")
      .attr("cx", 8)
      .attr("cy", 40)
      .attr("r", 4)
      .attr("fill", "#6b7280");

    legend.append("text")
      .attr("x", 18)
      .attr("y", 44)
      .style("font-size", "10px")
      .style("fill", "#374151")
      .text("Other Traits");

  }, [sortedData, dimensions, viewMode, sortBy, selectedDeterminant]);

  if (viewMode === 'table') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Incremental R² Data Table</h3>
          <p className="text-sm text-gray-600">
            {filteredData.length} entries | {filteredData.filter(d => d.is_gim).length} GIM traits
          </p>
        </div>
        
        <div className="overflow-auto max-h-96">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trait
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Determinant
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Incremental R²
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.metabolic_trait.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.determinant.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {item.incremental_r2.toFixed(4)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.is_gim 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.is_gim ? 'GIM' : 'Other'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-gray-200 rounded-lg bg-white"
      />
      
      {/* Tooltip */}
      {hoveredData && (
        <div className="absolute z-10 bg-black text-white p-3 rounded-lg shadow-lg text-sm max-w-xs pointer-events-none"
             style={{ 
               left: '50%', 
               top: '20px',
               transform: 'translateX(-50%)'
             }}>
          <div className="font-semibold">{hoveredData.metabolic_trait.replace(/_/g, ' ')}</div>
          <div className="text-blue-200">{hoveredData.determinant.replace(/_/g, ' ')}</div>
          <div>R²: {hoveredData.incremental_r2.toFixed(4)}</div>
          {hoveredData.is_gim && (
            <div className="text-yellow-300 font-semibold">GIM Trait</div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncrementalR2Interactive;

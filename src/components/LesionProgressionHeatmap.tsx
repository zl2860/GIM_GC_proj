import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface HeatmapData {
  gene: string;
  metabolic_trait: string;
  association_strength: number;
  is_causal: boolean;
  group: string;
}

interface LesionProgressionHeatmapProps {
  data: HeatmapData[];
  onCellClick?: (cell: HeatmapData) => void;
  selectedGene?: string | null;
  selectedTrait?: string | null;
}

interface Dimensions {
  width: number;
  height: number;
}

const LesionProgressionHeatmap: React.FC<LesionProgressionHeatmapProps> = ({ 
  data, 
  onCellClick,
  selectedGene,
  selectedTrait 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions] = useState<Dimensions>({ width: 1200, height: 800 });
  const [hoveredCell, setHoveredCell] = useState<HeatmapData | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 120, right: 50, bottom: 80, left: 180 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Get unique genes and traits
    const genes = [...new Set(data.map(d => d.gene))].sort();
    const traits = [...new Set(data.map(d => d.metabolic_trait))].sort();

    // Create scales
    const xScale = d3.scaleBand()
      .domain(genes)
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(traits)
      .range([0, height])
      .padding(0.05);

    // Color scale for association strength
    const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
      .domain([1, 0]); // Reverse scale so higher values are red

    // Create data lookup
    const dataLookup = new Map();
    data.forEach(d => {
      const key = `${d.gene}-${d.metabolic_trait}`;
      dataLookup.set(key, d);
    });

    // Main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Add background
    svg.append("rect")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("fill", "#ffffff");

    // Add title
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "600")
      .style("fill", "#111827")
      .text("GIMs for Gastric Lesion Progression - Gene-Metabolic Trait Associations");

    // Add subtitle with counts
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("fill", "#6b7280")
      .text(`${genes.length} genes × ${traits.length} metabolic traits | ${data.filter(d => d.is_causal).length} causal relationships`);

    // Create cells
    genes.forEach(gene => {
      traits.forEach(trait => {
        const key = `${gene}-${trait}`;
        const cellData = dataLookup.get(key);
        
        const cell = g.append("rect")
          .attr("x", xScale(gene)!)
          .attr("y", yScale(trait)!)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1);

        if (cellData) {
          cell
            .attr("fill", colorScale(cellData.association_strength))
            .style("cursor", "pointer")
            .style("opacity", 0.8);

          // Add causal indicator
          if (cellData.is_causal) {
            g.append("text")
              .attr("x", xScale(gene)! + xScale.bandwidth() / 2)
              .attr("y", yScale(trait)! + yScale.bandwidth() / 2)
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "middle")
              .style("font-size", "12px")
              .style("font-weight", "bold")
              .style("fill", "#000000")
              .style("pointer-events", "none")
              .text("*");
          }

          // Add interactions
          cell
            .on("mouseover", function(event) {
              d3.select(this)
                .style("opacity", 1)
                .attr("stroke", "#000000")
                .attr("stroke-width", 2);
              
              setHoveredCell(cellData);
            })
            .on("mouseout", function() {
              d3.select(this)
                .style("opacity", 0.8)
                .attr("stroke", "#ffffff")
                .attr("stroke-width", 1);
              
              setHoveredCell(null);
            })
            .on("click", function() {
              onCellClick?.(cellData);
            });
        } else {
          cell
            .attr("fill", "#f8f9fa")
            .style("opacity", 0.3);
        }

        // Highlight selected gene/trait
        if (selectedGene === gene || selectedTrait === trait) {
          cell.attr("stroke", "#111827").attr("stroke-width", 3);
        }
      });
    });

    // Add gene labels (x-axis)
    g.selectAll(".gene-label")
      .data(genes)
      .enter()
      .append("text")
      .attr("class", "gene-label")
      .attr("x", d => xScale(d)! + xScale.bandwidth() / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("transform", d => `rotate(-45, ${xScale(d)! + xScale.bandwidth() / 2}, -10)`)
      .style("font-size", "11px")
      .style("font-family", "system-ui, sans-serif")
      .style("fill", "#374151")
      .style("font-weight", d => selectedGene && d === selectedGene ? "600" : "400")
      .text(d => d);

    // Add trait labels (y-axis)
    g.selectAll(".trait-label")
      .data(traits)
      .enter()
      .append("text")
      .attr("class", "trait-label")
      .attr("x", -10)
      .attr("y", d => yScale(d)! + yScale.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "10px")
      .style("font-family", "system-ui, sans-serif")
      .style("fill", "#374151")
      .style("font-weight", d => selectedTrait && d === selectedTrait ? "600" : "400")
      .text(d => d.replace(/_/g, ' '));

    // Add color legend
    const legendWidth = 300;
    const legendHeight = 20;
    const legendX = width - legendWidth + margin.left;
    const legendY = 80;

    const legendScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".1f"));

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "lesion-legend-gradient");

    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(1 - t)); // Reverse for proper color mapping
    }

    svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#lesion-legend-gradient)")
      .style("stroke", "#d1d5db");

    svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis);

    svg.append("text")
      .attr("x", legendX + legendWidth / 2)
      .attr("y", legendY - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#6b7280")
      .text("Association Strength");

    // Add causal indicator legend
    const causalLegend = svg.append("g")
      .attr("transform", `translate(${legendX}, ${legendY + 50})`);

    causalLegend.append("text")
      .attr("x", 0)
      .attr("y", 0)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "#374151")
      .text("Legend:");

    causalLegend.append("text")
      .attr("x", 0)
      .attr("y", 20)
      .style("font-size", "11px")
      .style("fill", "#374151")
      .text("* = Causal relationship");

    // Add group information
    const groups = [...new Set(data.map(d => d.group))].sort();
    const groupColors = {
      'C': '#3b82f6',
      'CE': '#10b981', 
      'FC': '#8b5cf6',
      'PL': '#f59e0b',
      'TG': '#ef4444'
    };

    const groupLegend = svg.append("g")
      .attr("transform", `translate(50, ${dimensions.height - 60})`);

    groupLegend.append("text")
      .attr("x", 0)
      .attr("y", 0)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "#374151")
      .text("Metabolic Groups:");

    groups.forEach((group, i) => {
      const groupItem = groupLegend.append("g")
        .attr("transform", `translate(${i * 80}, 20)`);

      groupItem.append("circle")
        .attr("cx", 8)
        .attr("cy", 0)
        .attr("r", 4)
        .attr("fill", groupColors[group as keyof typeof groupColors] || '#6b7280');

      groupItem.append("text")
        .attr("x", 18)
        .attr("y", 4)
        .style("font-size", "10px")
        .style("fill", "#374151")
        .text(group);
    });

  }, [data, dimensions, selectedGene, selectedTrait, onCellClick]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-gray-200 rounded-lg bg-white"
      />
      
      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute z-10 bg-black text-white p-3 rounded-lg shadow-lg text-sm max-w-xs pointer-events-none"
             style={{ 
               left: '50%', 
               top: '20px',
               transform: 'translateX(-50%)'
             }}>
          <div className="font-semibold">{hoveredCell.gene}</div>
          <div className="text-blue-200">{hoveredCell.metabolic_trait.replace(/_/g, ' ')}</div>
          <div>Association: {hoveredCell.association_strength.toFixed(3)}</div>
          <div>Group: {hoveredCell.group}</div>
          {hoveredCell.is_causal && (
            <div className="text-yellow-300 font-semibold">* Causal relationship</div>
          )}
        </div>
      )}
    </div>
  );
};

export default LesionProgressionHeatmap;

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Association {
  gene: string;
  metabolite: string;
  effect: number;
  pvalue: number;
  locus: string;
}

interface HeatmapProps {
  data: Association[];
  genes: string[];
  metabolites: string[];
  onCellClick?: (association: Association) => void;
  selectedLocus?: string;
}

const InteractiveHeatmap: React.FC<HeatmapProps> = ({ 
  data, 
  genes, 
  metabolites, 
  onCellClick,
  selectedLocus 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCell, setHoveredCell] = useState<Association | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current?.parentElement) {
        const parent = svgRef.current.parentElement;
        setDimensions({
          width: Math.max(800, parent.clientWidth - 40),
          height: Math.max(600, Math.min(800, genes.length * 25 + 200))
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [genes.length]);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 120, right: 40, bottom: 60, left: 120 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Create association map for quick lookup
    const associationMap = new Map<string, Association>();
    data.forEach(assoc => {
      const key = `${assoc.gene}-${assoc.metabolite}`;
      associationMap.set(key, assoc);
    });

    // Scales
    const xScale = d3.scaleBand()
      .domain(metabolites)
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(genes)
      .range([0, height])
      .padding(0.05);

    // Color scale for effect sizes
    const colorScale = d3.scaleSequential()
      .domain([-1, 1])
      .interpolator(d3.interpolateRdBu);

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add background
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8f9fa")
      .attr("stroke", "#e9ecef");

    // Create cells
    genes.forEach(gene => {
      metabolites.forEach(metabolite => {
        const key = `${gene}-${metabolite}`;
        const association = associationMap.get(key);
        
        const cell = g.append("rect")
          .attr("x", xScale(metabolite)!)
          .attr("y", yScale(gene)!)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("fill", association ? colorScale(association.effect) : "#f8f9fa")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1)
          .style("cursor", association ? "pointer" : "default")
          .style("opacity", association ? 0.8 : 0.3);

        if (association) {
          cell
            .on("mouseover", function(event) {
              d3.select(this).style("opacity", 1).attr("stroke-width", 2);
              setHoveredCell(association);
            })
            .on("mouseout", function() {
              d3.select(this).style("opacity", 0.8).attr("stroke-width", 1);
              setHoveredCell(null);
            })
            .on("click", function() {
              onCellClick?.(association);
            });
        }
      });
    });

    // Add gene labels (y-axis)
    g.selectAll(".gene-label")
      .data(genes)
      .enter()
      .append("text")
      .attr("class", "gene-label")
      .attr("x", -10)
      .attr("y", d => yScale(d)! + yScale.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "12px")
      .style("font-family", "system-ui, sans-serif")
      .style("fill", "#374151")
      .text(d => d);

    // Add metabolite labels (x-axis)
    g.selectAll(".metabolite-label")
      .data(metabolites)
      .enter()
      .append("text")
      .attr("class", "metabolite-label")
      .attr("x", d => xScale(d)! + xScale.bandwidth() / 2)
      .attr("y", -10)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "middle")
      .attr("transform", d => `rotate(-45, ${xScale(d)! + xScale.bandwidth() / 2}, -10)`)
      .style("font-size", "11px")
      .style("font-family", "system-ui, sans-serif")
      .style("fill", "#374151")
      .text(d => d);

    // Add title
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "600")
      .style("fill", "#111827")
      .text("Gene-Metabolite Association Matrix");

    // Add color legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = width - legendWidth + margin.left;
    const legendY = 50;

    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".1f"));

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient");

    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const value = -1 + t * 2;
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(value));
    }

    svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)")
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
      .text("Effect Size");

  }, [data, genes, metabolites, dimensions, onCellClick]);

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
        <div className="absolute z-10 bg-black text-white p-3 rounded-lg shadow-lg text-sm max-w-xs">
          <div className="font-semibold">{hoveredCell.gene} - {hoveredCell.metabolite}</div>
          <div>Effect: {hoveredCell.effect > 0 ? '+' : ''}{hoveredCell.effect.toFixed(3)}</div>
          <div>P-value: {hoveredCell.pvalue.toExponential(2)}</div>
          <div>Locus: {hoveredCell.locus}</div>
        </div>
      )}
    </div>
  );
};

export default InteractiveHeatmap;

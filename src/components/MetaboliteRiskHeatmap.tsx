import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface RiskData {
  biomarker: string;
  ukbb_measured: number | null;
  ukbb_predicted: number | null;
  sit_predicted: number | null;
  mits_predicted: number | null;
  ugced_predicted: number | null;
}

interface HeatmapProps {
  data: RiskData[];
  onBiomarkerClick?: (biomarker: RiskData) => void;
  selectedCohort: string;
}

const MetaboliteRiskHeatmap: React.FC<HeatmapProps> = ({ 
  data, 
  onBiomarkerClick,
  selectedCohort 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{biomarker: string, cohort: string, value: number} | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const cohorts = [
    { key: 'ukbb_measured', label: 'UKBB Measured' },
    { key: 'ukbb_predicted', label: 'UKBB Predicted' },
    { key: 'sit_predicted', label: 'SIT Predicted' },
    { key: 'mits_predicted', label: 'MITS Predicted' },
    { key: 'ugced_predicted', label: 'UGCED Predicted' }
  ];

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current?.parentElement) {
        const parent = svgRef.current.parentElement;
        setDimensions({
          width: Math.max(900, parent.clientWidth - 40),
          height: Math.max(600, Math.min(1000, data.length * 20 + 200))
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data.length]);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 100, right: 40, bottom: 60, left: 180 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Filter cohorts based on selection
    const activeCohorts = selectedCohort === 'all' ? cohorts : cohorts.filter(c => c.key === selectedCohort);

    // Create scales
    const xScale = d3.scaleBand()
      .domain(activeCohorts.map(c => c.key))
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.biomarker))
      .range([0, height])
      .padding(0.02);

    // Find min/max values for color scale - normalize to -1 to 1 range
    const allValues = data.flatMap(d => [
      d.ukbb_measured, d.ukbb_predicted, d.sit_predicted, 
      d.mits_predicted, d.ugced_predicted
    ]).filter(v => v !== null) as number[];
    
    const extent = d3.extent(allValues) as [number, number];
    const maxAbs = Math.max(Math.abs(extent[0]), Math.abs(extent[1]));

    // Color scale with normalized range for better visualization
    const colorScale = d3.scaleSequential()
      .domain([-1, 1])
      .interpolator(d3.interpolateRdBu);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        const transform = event.transform;
        setZoomTransform(transform);
        
        // Apply zoom to content
        zoomableGroup.attr("transform", transform.toString());
        
        // Update axes with zoom
        const newXScale = transform.rescaleX(xScale);
        const newYScale = transform.rescaleY(yScale);
        
        // Update axis labels visibility based on zoom level
        if (transform.k > 1.5) {
          yAxisLabels.style("display", "block");
        } else {
          yAxisLabels.style("display", d => data.indexOf(d) % Math.ceil(2 / transform.k) === 0 ? "block" : "none");
        }
      });

    // Apply zoom to SVG
    svg.call(zoom);

    // Create main group
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create zoomable content group
    const zoomableGroup = g.append("g")
      .attr("class", "zoomable-content");

    // Add background
    zoomableGroup.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f8f9fa")
      .attr("stroke", "#e9ecef");

    // Create cells
    data.forEach(row => {
      activeCohorts.forEach(cohort => {
        const value = row[cohort.key as keyof RiskData] as number | null;
        
        // Normalize the value to -1 to 1 range for color mapping
        const normalizedValue = value !== null ? value / maxAbs : null;
        
        const cell = zoomableGroup.append("rect")
          .attr("x", xScale(cohort.key)!)
          .attr("y", yScale(row.biomarker)!)
          .attr("width", xScale.bandwidth())
          .attr("height", yScale.bandwidth())
          .attr("fill", normalizedValue !== null ? colorScale(normalizedValue) : "#f0f0f0")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1)
          .style("cursor", value !== null ? "pointer" : "default")
          .style("opacity", value !== null ? 0.8 : 0.3);

        if (value !== null) {
          cell
            .on("mouseover", function(event) {
              d3.select(this).style("opacity", 1).attr("stroke-width", 2).attr("stroke", "#333");
              setHoveredCell({
                biomarker: row.biomarker,
                cohort: cohort.label,
                value: value // Use original value for tooltip
              });
            })
            .on("mouseout", function() {
              d3.select(this).style("opacity", 0.8).attr("stroke-width", 1).attr("stroke", "#ffffff");
              setHoveredCell(null);
            })
            .on("click", function() {
              onBiomarkerClick?.(row);
            });
        }
      });
    });

    // Add biomarker labels (y-axis)
    const yAxisLabels = zoomableGroup.selectAll(".biomarker-label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "biomarker-label")
      .attr("x", -10)
      .attr("y", d => yScale(d.biomarker)! + yScale.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .style("font-size", "11px")
      .style("font-family", "system-ui, sans-serif")
      .style("fill", "#374151")
      .text(d => d?.biomarker ? d.biomarker.replace(/_/g, ' ') : '');

    // Add cohort labels (x-axis) - these stay fixed during zoom
    g.selectAll(".cohort-label")
      .data(activeCohorts)
      .enter()
      .append("text")
      .attr("class", "cohort-label")
      .attr("x", d => xScale(d.key)! + xScale.bandwidth() / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "12px")
      .style("font-family", "system-ui, sans-serif")
      .style("fill", "#374151")
      .style("font-weight", "600")
      .text(d => d.label);

    // Add zoom controls
    const zoomControls = svg.append("g")
      .attr("class", "zoom-controls")
      .attr("transform", `translate(${dimensions.width - 100}, 10)`);

    // Zoom in button
    const zoomInBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .style("cursor", "pointer")
      .on("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5);
      });

    zoomInBtn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", "#fff")
      .attr("stroke", "#ccc")
      .attr("rx", 4);

    zoomInBtn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("+");

    // Zoom out button
    const zoomOutBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .attr("transform", "translate(35, 0)")
      .style("cursor", "pointer")
      .on("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 0.67);
      });

    zoomOutBtn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", "#fff")
      .attr("stroke", "#ccc")
      .attr("rx", 4);

    zoomOutBtn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("−");

    // Reset zoom button
    const resetBtn = zoomControls.append("g")
      .attr("class", "zoom-btn")
      .attr("transform", "translate(70, 0)")
      .style("cursor", "pointer")
      .on("click", () => {
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      });

    resetBtn.append("rect")
      .attr("width", 30)
      .attr("height", 30)
      .attr("fill", "#fff")
      .attr("stroke", "#ccc")
      .attr("rx", 4);

    resetBtn.append("text")
      .attr("x", 15)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text("⌂");

    // Add title
    svg.append("text")
      .attr("x", dimensions.width / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "600")
      .style("fill", "#111827")
      .text("Metabolite-Gastric Cancer Risk Associations");

    // Add color legend with original value scale
    const legendWidth = 300;
    const legendHeight = 20;
    const legendX = width - legendWidth + margin.left;
    const legendY = 60;

    const legendScale = d3.scaleLinear()
      .domain([-maxAbs, maxAbs])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".2f"));

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "risk-legend-gradient");

    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const normalizedValue = -1 + t * 2; // -1 to 1 for color scale
      gradient.append("stop")
        .attr("offset", `${t * 100}%`)
        .attr("stop-color", colorScale(normalizedValue));
    }

    svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#risk-legend-gradient)")
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
      .text("Relative Risk (Original Values)");

    // Add zoom instructions
    svg.append("text")
      .attr("x", 20)
      .attr("y", dimensions.height - 10)
      .style("font-size", "10px")
      .style("fill", "#6b7280")
      .text("Use mouse wheel to zoom, drag to pan, or use controls (top-right)");

  }, [data, dimensions, selectedCohort, onBiomarkerClick, zoomTransform]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-gray-200 rounded-lg bg-white cursor-move"
      />
      
      {/* Tooltip */}
      {hoveredCell && (
        <div className="absolute z-10 bg-black text-white p-3 rounded-lg shadow-lg text-sm max-w-xs pointer-events-none"
             style={{ 
               left: '50%', 
               top: '20px',
               transform: 'translateX(-50%)'
             }}>
          <div className="font-semibold">{hoveredCell.biomarker ? hoveredCell.biomarker.replace(/_/g, ' ') : ''}</div>
          <div>{hoveredCell.cohort}</div>
          <div>Risk: {hoveredCell.value > 0 ? '+' : ''}{hoveredCell.value.toFixed(3)}</div>
        </div>
      )}
      
      {/* Zoom level indicator */}
      <div className="absolute top-2 left-2 bg-white bg-opacity-80 px-2 py-1 rounded text-xs text-gray-600">
        Zoom: {zoomTransform.k.toFixed(1)}x
      </div>
    </div>
  );
};

export default MetaboliteRiskHeatmap;

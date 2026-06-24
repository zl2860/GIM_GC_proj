import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Loader2, Info } from 'lucide-react';

interface LesionProgressionData {
  gene: string;
  metabolic_trait: string;
  association_strength: number;
  is_causal: boolean;
  group: string;
  p_value?: number;
  effect_size?: number;
}

interface RobustLesionProgressionHeatmapProps {
  data: LesionProgressionData[];
  onCellClick?: (association: LesionProgressionData) => void;
}

const getSpatialTraitHref = (trait: string) =>
  `${import.meta.env.BASE_URL}spatial-distribution?trait=${encodeURIComponent(trait)}&layer=trait`;

const RobustLesionProgressionHeatmap: React.FC<RobustLesionProgressionHeatmapProps> = ({ 
  data, 
  onCellClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(0.82);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Process data (filtering is done by parent component)
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return { genes: [], groups: [], traits: [], matrixData: [] };

    const genes = Array.from(new Set(data.map(d => d.gene))).sort();
    const groups = Array.from(new Set(data.map(d => d.group))).sort();
    const traits = Array.from(new Set(data.map(d => d.metabolic_trait))).sort();

    // Use data as-is (already filtered by parent)
    const filteredData = data;

    // Create matrix data for heatmap
    const filteredGenes = Array.from(new Set(filteredData.map(d => d.gene))).sort();
    const filteredTraits = Array.from(new Set(filteredData.map(d => d.metabolic_trait))).sort();

    const matrixData = filteredGenes.flatMap(gene => 
      filteredTraits.map(trait => {
        const match = filteredData.find(d => d.gene === gene && d.metabolic_trait === trait);
        return {
          gene,
          trait,
          value: match ? match.association_strength : 0,
          isCausal: match ? match.is_causal : false,
          group: match ? match.group : '',
          hasData: !!match,
          rawData: match
        };
      })
    );

    return { genes: filteredGenes, groups, traits: filteredTraits, matrixData };
  }, [data]);

  const renderHeatmap = React.useCallback(() => {
    if (!svgRef.current || processedData.matrixData.length === 0) return;

    setIsRendering(true);
    setError(null);

    try {
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const margin = { top: 100, right: 150, bottom: 120, left: 150 };
      const cellSize = 20;
      const width = processedData.traits.length * cellSize;
      const height = processedData.genes.length * cellSize;
      const totalWidth = width + margin.left + margin.right;
      const totalHeight = height + margin.bottom + margin.top;

      svg
        .attr("width", totalWidth)
        .attr("height", totalHeight)
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`);
      setDimensions({ width: totalWidth, height: totalHeight });

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      if (processedData.matrixData.filter(d => d.hasData).length === 0) {
        g.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("fill", "#cbd5e1")
          .text("No data matches current filters");
        setIsRendering(false);
        return;
      }

      // Scales
      const xScale = d3.scaleBand()
        .domain(processedData.traits)
        .range([0, width])
        .padding(0.02);

      const yScale = d3.scaleBand()
        .domain(processedData.genes)
        .range([0, height])
        .padding(0.02);

      const colorScale = d3.scaleSequential(d3.interpolateRdYlBu)
        .domain(d3.extent(processedData.matrixData.filter(d => d.hasData), d => d.value).reverse() as [number, number]);

      // Create tooltip. Hover previews disappear; clicked cells pin the tooltip so links are usable.
      d3.select(window).on("click.lesion-heatmap-tooltip", null);
      let hideTimer: number | undefined;
      let tooltipPinned = false;
      const tooltip = d3.select("body").selectAll(".lesion-heatmap-tooltip")
        .data([0])
        .join("div")
        .attr("class", "lesion-heatmap-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.9)")
        .style("color", "white")
        .style("padding", "10px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("pointer-events", "auto")
        .style("opacity", 0)
        .style("z-index", 1000)
        .style("max-width", "290px");

      const closeTooltip = () => {
        tooltipPinned = false;
        if (hideTimer) window.clearTimeout(hideTimer);
        tooltip.style("opacity", 0);
      };

      const hideTooltip = () => {
        if (tooltipPinned) return;
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
          if (!tooltipPinned) tooltip.style("opacity", 0);
        }, 220);
      };

      const showTooltip = (pinned = false) => {
        if (hideTimer) window.clearTimeout(hideTimer);
        tooltipPinned = pinned || tooltipPinned;
        tooltip.style("opacity", 1);
      };

      const positionTooltip = (event: MouseEvent) => {
        tooltip
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 10}px`);
      };

      const renderTooltip = (d: {
        gene: string;
        trait: string;
        value: number;
        group: string;
        isCausal: boolean;
      }, pinned = false) => {
        tooltip.html(`
          <div class="gim-tooltip-header">
            <strong>${d.gene} - ${d.trait}</strong>
            ${pinned ? '<button class="gim-tooltip-close" type="button" aria-label="Close tooltip">×</button>' : ''}
          </div>
          Association: ${d.value.toFixed(3)}<br/>
          Group: ${d.group}<br/>
          ${d.isCausal ? '<span style="color: #ff6666;">Putative causal</span>' : 'Non-causal'}<br/>
          <em>${pinned ? 'Pinned cell' : 'Click to pin and show details'}</em>
          <br/><a class="gim-tooltip-spatial-link" href="${getSpatialTraitHref(d.trait)}">View trait signals in spatial transcriptomic profiles</a>
        `);
        tooltip.select(".gim-tooltip-close").on("click", (event) => {
          event.stopPropagation();
          closeTooltip();
        });
      };

      tooltip
        .on("mouseenter", () => {
          if (hideTimer) window.clearTimeout(hideTimer);
          tooltip.style("opacity", 1);
        })
        .on("mouseleave", hideTooltip)
        .on("click", event => {
          event.stopPropagation();
        });

      d3.select(window).on("click.lesion-heatmap-tooltip", closeTooltip);

      // Draw heatmap cells
      g.selectAll(".heatmap-cell")
        .data(processedData.matrixData)
        .join("rect")
        .attr("class", "heatmap-cell")
        .attr("x", d => xScale(d.trait) || 0)
        .attr("y", d => yScale(d.gene) || 0)
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .style("fill", d => d.hasData ? colorScale(d.value) : "#0b1220")
        .style("stroke", d => d.isCausal ? "#ff4444" : "#1e293b")
        .style("stroke-width", d => d.isCausal ? 2 : 0.5)
        .style("cursor", d => d.hasData ? "pointer" : "default")
        .on("mouseover", function(event, d) {
          if (!d.hasData) return;

          if (tooltipPinned) return;
          renderTooltip(d, false);
          positionTooltip(event);
          showTooltip();
        })
        .on("mousemove", function(event) {
          if (!tooltipPinned) {
            positionTooltip(event);
          }
        })
        .on("mouseout", function() {
          hideTooltip();
        })
        .on("click", function(event, d) {
          if (d.hasData && d.rawData && onCellClick) {
            event.stopPropagation();
            onCellClick(d.rawData);
            tooltipPinned = true;
            renderTooltip(d, true);
            positionTooltip(event);
            showTooltip(true);
          }
        });

      // Add causal indicator dots
      g.selectAll(".causal-indicator")
        .data(processedData.matrixData.filter(d => d.hasData && d.isCausal))
        .join("circle")
        .attr("class", "causal-indicator")
        .attr("cx", d => (xScale(d.trait) || 0) + xScale.bandwidth() - 4)
        .attr("cy", d => (yScale(d.gene) || 0) + 4)
        .attr("r", 3)
        .style("fill", "#ff4444")
        .style("pointer-events", "none");

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

      // Axis labels
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("Genes");

      g.append("text")
        .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 20})`)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text("Metabolomic traits");

      // Title
      g.append("text")
        .attr("x", width / 2)
        .attr("y", -60)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(`Gene-trait association heatmap`);

      g.append("text")
        .attr("x", width / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#cbd5e1")
        .text(`${processedData.matrixData.filter(d => d.hasData).length} associations | Red borders indicate putative causal relationships`);

      // Color legend
      const legendWidth = 200;
      const legendHeight = 15;
      
      const legend = g.append("g")
        .attr("transform", `translate(${width + 20}, 20)`);

      const legendScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendHeight * 10]);

      // Vertical color bar
      legend.selectAll(".legend-rect")
        .data(d3.range(0, legendHeight * 10, 2))
        .join("rect")
        .attr("x", 0)
        .attr("y", d => d)
        .attr("width", 15)
        .attr("height", 2)
        .style("fill", d => colorScale(legendScale.invert(d)));

      // Legend axis
      const legendAxis = d3.axisRight(d3.scaleLinear()
        .domain(colorScale.domain())
        .range([0, legendHeight * 10]))
        .ticks(5)
        .tickFormat(d3.format(".2f"));

      legend.append("g")
        .attr("transform", "translate(15, 0)")
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "10px");

      legend.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -10)
        .attr("x", -(legendHeight * 5))
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Association strength");

      // Causal legend
      const causalLegend = legend.append("g")
        .attr("transform", `translate(0, ${legendHeight * 10 + 40})`);

      causalLegend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 15)
        .attr("height", 15)
        .style("fill", "#0b1220")
        .style("stroke", "#ff4444")
        .style("stroke-width", 2);

      causalLegend.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .style("font-size", "10px")
        .text("Putative causal");

    } catch (err) {
      console.error('Error rendering lesion progression heatmap:', err);
      setError('Failed to render heatmap visualization');
    } finally {
      setIsRendering(false);
    }
  }, [processedData, onCellClick]);

  useEffect(() => {
    renderHeatmap();
  }, [renderHeatmap]);

  useEffect(() => {
    return () => {
      d3.select(window).on("click.lesion-heatmap-tooltip", null);
      d3.select("body").selectAll(".lesion-heatmap-tooltip").remove();
    };
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-700 font-medium">Visualization error</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
        <button 
          onClick={renderHeatmap}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry rendering
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Total associations</h3>
          <p className="text-2xl font-bold text-gray-900">
            {processedData.matrixData.filter(d => d.hasData).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Putative causal associations</h3>
          <p className="text-2xl font-bold text-red-600">
            {processedData.matrixData.filter(d => d.hasData && d.isCausal).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Unique genes</h3>
          <p className="text-2xl font-bold text-blue-600">{processedData.genes.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-500">Metabolomic traits</h3>
          <p className="text-2xl font-bold text-green-600">{processedData.traits.length}</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900">Heatmap guide</h3>
            <p className="text-sm text-blue-700 mt-1">
              Each cell represents a gene–metabolomic trait association. Color intensity indicates association strength. 
              Red borders highlight putative causal relationships. Click on cells for detailed information.
            </p>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="relative overflow-x-auto">
          {isRendering && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-10">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-sm text-gray-600">Rendering heatmap...</span>
              </div>
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-300">Zoom</span>
            {[0.7, 0.85, 1, 1.2].map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => setZoomScale(scale)}
                className={`rounded-md border px-2.5 py-1 font-semibold transition ${
                  zoomScale === scale
                    ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                    : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-cyan-400'
                }`}
              >
                {Math.round(scale * 100)}%
              </button>
            ))}
          </div>
          <svg
            ref={svgRef}
            width={dimensions.width * zoomScale}
            height={dimensions.height * zoomScale}
            className="rounded border border-slate-700 bg-slate-950"
          ></svg>
        </div>
      </div>
    </div>
  );
};

export default RobustLesionProgressionHeatmap;

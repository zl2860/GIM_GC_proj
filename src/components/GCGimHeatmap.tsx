import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface GCGimData {
  gene: string;
  Biomarker: string;
  'value.update': string;
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
  is_causal: string;
}

interface GCGimHeatmapProps {
  data: GCGimData[];
  genes: string[];
  metabolites: string[];
  onAssociationClick: (association: GCGimData) => void;
  activeGene?: string | null;
}

const SIGNIFICANCE_THRESHOLD = 5e-8;

const GCGimHeatmap: React.FC<GCGimHeatmapProps> = ({
  data,
  genes,
  metabolites,
  onAssociationClick,
  activeGene
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // More vibrant and distinct colors for each functional type
  const functionalTypeColors: { [key: string]: string } = {
    'intronic': '#FF4757', // Bright Red
    'UTR5': '#2ED573', // Bright Green
    'intergenic': '#3742FA', // Bright Blue
    'downstream': '#FFA502', // Bright Orange
    'ncRNA_intronic': '#FF6348', // Bright Coral
    'exonic': '#8B5CF6', // Bright Purple
    'UTR3': '#FF6B35', // Bright Orange-Red
    'upstream': '#FF1493', // Deep Pink
    'ncRNA_exonic': '#00D2D3' // Bright Cyan
  };

  useEffect(() => {
    if (!svgRef.current || !data.length || !genes.length || !metabolites.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 80, right: 200, bottom: 150, left: 200 };
    const width = Math.max(800, genes.length * 25);
    const height = Math.max(600, metabolites.length * 20);
    
    setDimensions({ width: width + margin.left + margin.right, height: height + margin.top + margin.bottom });

    const innerWidth = width;
    const innerHeight = height;

    // Filter genes and metabolites based on data availability
    const availableGenes = genes.filter(gene => 
      data.some(d => d.gene === gene)
    );
    const availableMetabolites = metabolites.filter(metabolite => 
      data.some(d => d.Metabolite === metabolite)
    );

    // Create scales
    const xScale = d3.scaleBand()
      .domain(availableGenes)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleBand()
      .domain(availableMetabolites)
      .range([0, innerHeight])
      .padding(0.1);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create data map for quick lookup
    const dataMap = new Map<string, GCGimData>();
    data.forEach(d => {
      const key = `${d.gene}-${d.Metabolite}`;
      dataMap.set(key, d);
    });

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'gc-gim-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .style('max-width', '300px');

    // Create color scale
    const pValues = data.map(d => d.P_value).filter(p => p > 0);
    const logPValues = pValues.map(p => -Math.log10(p));
    const minPValue = pValues.length ? Math.min(...pValues) : 1e-12;
    const [rawMinLog, rawMaxLog] = logPValues.length
      ? (d3.extent(logPValues) as [number, number])
      : [0, 1];

    const sortedLog = logPValues.slice().sort(d3.ascending);
    const q1 = sortedLog.length
      ? d3.quantile(sortedLog, 0.1) ?? rawMinLog
      : rawMinLog;
    const q3 = sortedLog.length
      ? d3.quantile(sortedLog, 0.9) ?? rawMaxLog
      : rawMaxLog;

    const minLogExtent = Math.min(rawMinLog, q1);
    const maxLogExtent = Math.max(rawMaxLog, q3);

    const extentRange: [number, number] =
      minLogExtent === maxLogExtent
        ? [minLogExtent - 1, maxLogExtent + 1]
        : [minLogExtent, maxLogExtent];

    const opacityScale = d3
      .scaleLinear<number, number>()
      .domain(extentRange)
      .range([0.25, 1])
      .clamp(true);

    const logThreshold = -Math.log10(SIGNIFICANCE_THRESHOLD);

    const significantMax = Math.max(maxLogExtent, logThreshold + 0.5);

    const intensityScale = d3
      .scaleLinear<number, number>()
      .domain([logThreshold, significantMax])
      .range([0.6, 1])
      .clamp(true);

    // Create cells
    const cells = g.selectAll('.cell')
      .data(availableGenes.flatMap(gene => 
        availableMetabolites.map(metabolite => ({
          gene,
          metabolite,
          data: dataMap.get(`${gene}-${metabolite}`)
        }))
      ))
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${xScale(d.gene)},${yScale(d.metabolite)})`);

    const isActiveGene = (gene: string) => {
      if (!activeGene) return false;
      return gene === activeGene;
    };

    cells.append('rect')
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => {
        if (!d.data) return '#ffffff';

        const functionalType = d.data['value.update'];
        const baseColor = functionalTypeColors[functionalType] || '#2563eb';
        const logP =
          d.data.P_value === 0
            ? significantMax
            : -Math.log10(d.data.P_value);

        if (d.data.P_value > SIGNIFICANCE_THRESHOLD) {
          return '#ffffff';
        }

        const t = intensityScale(logP);
        return d3.interpolateRgb('#172554', baseColor)(t);
      })
      .attr('stroke', d => {
        if (!d.data) return '#e5e7eb';
        const functionalType = d.data['value.update'];
        const baseColor = functionalTypeColors[functionalType] || '#2563eb';
        return d3.interpolateRgb('#0f172a', baseColor)(0.6);
      })
      .attr('stroke-width', d => (isActiveGene(d.gene) ? 2.5 : 0.8))
      .style('cursor', d => d.data ? 'pointer' : 'default')
      .style('opacity', d => {
        if (!d.data) return 0.1;

        if (d.data.P_value > SIGNIFICANCE_THRESHOLD) {
          return isActiveGene(d.gene) ? 0.6 : 0.35;
        }

        const logP =
          d.data.P_value === 0
            ? significantMax
            : -Math.log10(d.data.P_value);
        const baseOpacity = opacityScale(logP);
        return isActiveGene(d.gene) ? Math.min(baseOpacity + 0.2, 1) : baseOpacity;
      })
      .on('mouseover', function(event, d) {
        if (!d.data) return;
        
        d3.select(this)
          .interrupt()
          .transition()
          .duration(150)
          .style('opacity', 1)
          .attr('stroke-width', 3);

        const logP = d.data.P_value === 0 ? significantMax : -Math.log10(d.data.P_value);
        const tooltipContent = `
          <strong>${d.data.gene} → ${d.data.Metabolite}</strong><br/>
          <strong>Functional Type:</strong> ${d.data['value.update'] || 'Unknown'}<br/>
          <strong>P-value:</strong> ${d.data.P_value.toExponential(2)}<br/>
          <strong>-log10(P):</strong> ${logP.toFixed(2)}<br/>
          <strong>Putative causal:</strong> ${d.data.is_causal}<br/>
          <strong>Beta (Pred):</strong> ${d.data['Beta.pred'].toFixed(3)}<br/>
          <strong>Beta (True):</strong> ${d.data['Beta.true'].toFixed(3)}<br/>
          <strong>Beta (MR):</strong> ${d.data['Beta.MR'].toFixed(3)}
        `;
        
        tooltip.html(tooltipContent)
          .style('visibility', 'visible')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        if (!d.data) return;
        d3.select(this)
          .interrupt()
          .transition()
          .duration(200)
          .style('opacity', () => {
            const base =
              d.data.P_value === 0
                ? opacityScale(extentRange[1])
                : opacityScale(-Math.log10(d.data.P_value));
            return isActiveGene(d.gene) ? Math.min(base + 0.2, 1) : base;
          })
          .attr('stroke-width', isActiveGene(d.gene) ? 2.5 : 0.8);
        tooltip.style('visibility', 'hidden');
      })
      .on('click', function(event, d) {
        if (d.data) {
          onAssociationClick(d.data);
        }
      });

    // Add causal indicators
    cells.filter(d => d.data && d.data.is_causal === 'Yes')
      .append('text')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', 'black')
      .style('pointer-events', 'none')
      .text('*');

    // Add x-axis (genes)
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .selectAll('text')
      .style('text-anchor', 'start')
      .attr('dx', '0.8em')
      .attr('dy', '0.15em')
      .attr('transform', 'rotate(45)')
      .style('font-size', '10px');

    // Add y-axis (metabolites) — keep underscores in trait names
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).tickSize(0))
      .selectAll('text')
      .style('font-size', '10px')
      .text(d => String(d));

    // Add color legend for -log10(P) values
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = innerWidth - legendWidth - 20;
    const legendY = -60;

    // Create legend gradient
    const legendGradient = g.append('defs')
      .append('linearGradient')
      .attr('id', 'colorGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    legendGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#FFE5E5');

    legendGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#FF0000');

    // Add legend rectangle
    g.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#colorGradient)')
      .attr('stroke', '#ccc');

    // Add legend labels
    const sortedPValues = pValues.sort((a, b) => a - b);
    const p25 = sortedPValues[Math.floor(sortedPValues.length * 0.25)];
    const p75 = sortedPValues[Math.floor(sortedPValues.length * 0.75)];
    const minLogP = -Math.log10(p75);
    const maxLogP = -Math.log10(p25);
    
    g.append('text')
      .attr('x', legendX)
      .attr('y', legendY - 5)
      .attr('text-anchor', 'start')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`-log10(P): ${minLogP.toFixed(1)}`);

    g.append('text')
      .attr('x', legendX + legendWidth)
      .attr('y', legendY - 5)
      .attr('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(`${maxLogP.toFixed(1)}`);

    // Add legend title
    g.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', legendY - 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text('Opacity Intensity (-log10 P-value)');

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 20})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Genes');

    g.append('text')
      .attr('transform', `translate(${-margin.left + 20}, ${innerHeight / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .text('Metabolomic Traits');

    // Add title
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${-margin.top / 2})`)
      .style('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('The GIM for GC');

    // Add legend
    const legendData = Object.entries(functionalTypeColors);
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${innerWidth + 20}, 20)`);

    const legendItems = legend.selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);

    legendItems.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', d => d[1])
      .attr('stroke', '#e5e7eb');

    legendItems.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .style('font-size', '12px')
      .text(d => d[0]);

    // Add causal indicator legend
    legend.append('g')
      .attr('transform', `translate(0, ${legendData.length * 25 + 10})`)
      .call(g => {
        g.append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', '#6b7280')
          .attr('stroke', '#e5e7eb');
        
        g.append('text')
          .attr('x', 7.5)
          .attr('y', 12)
          .attr('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('font-weight', 'bold')
          .style('fill', 'black')
          .text('*');
          
        g.append('text')
          .attr('x', 20)
          .attr('y', 12)
          .style('font-size', '12px')
          .text('Putative causal');
      });

    // Clean up tooltip on unmount
    return () => {
      d3.select('.gc-gim-tooltip').remove();
    };

  }, [data, genes, metabolites, onAssociationClick, activeGene]);

  return (
    <div className="w-full overflow-auto">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-gray-200 rounded"
      />
    </div>
  );
};

export default GCGimHeatmap;

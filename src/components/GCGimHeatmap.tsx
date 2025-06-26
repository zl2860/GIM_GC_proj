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
}

const GCGimHeatmap: React.FC<GCGimHeatmapProps> = ({ 
  data, 
  genes, 
  metabolites, 
  onAssociationClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const functionalTypeColors: { [key: string]: string } = {
    'intronic': '#3B82F6', // Blue
    'UTR5': '#10B981', // Green
    'intergenic': '#8B5CF6', // Purple
    'downstream': '#F59E0B', // Orange
    'ncRNA_intronic': '#EF4444', // Red
    'exonic': '#6366F1', // Indigo
    'UTR3': '#EAB308', // Yellow
    'upstream': '#EC4899', // Pink
    'ncRNA_exonic': '#14B8A6' // Teal
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

    // Create scales
    const xScale = d3.scaleBand()
      .domain(genes)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleBand()
      .domain(metabolites)
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

    // Create cells
    const cells = g.selectAll('.cell')
      .data(genes.flatMap(gene => 
        metabolites.map(metabolite => ({
          gene,
          metabolite,
          data: dataMap.get(`${gene}-${metabolite}`)
        }))
      ))
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', d => `translate(${xScale(d.gene)},${yScale(d.metabolite)})`);

    // Add rectangles
    cells.append('rect')
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => {
        if (!d.data || !d.data['value.update']) return '#f8f9fa';
        return functionalTypeColors[d.data['value.update']] || '#6b7280';
      })
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 0.5)
      .style('cursor', d => d.data ? 'pointer' : 'default')
      .style('opacity', d => d.data ? 0.8 : 0.1)
      .on('mouseover', function(event, d) {
        if (!d.data) return;
        
        d3.select(this).style('opacity', 1);
        
        const tooltipContent = `
          <strong>${d.data.gene} ↔ ${d.data.Metabolite}</strong><br/>
          <strong>Functional Type:</strong> ${d.data['value.update'] || 'Unknown'}<br/>
          <strong>P-value:</strong> ${d.data.P_value.toExponential(2)}<br/>
          <strong>Causal:</strong> ${d.data.is_causal}<br/>
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
        d3.select(this).style('opacity', 0.8);
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
      .style('fill', 'white')
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

    // Add y-axis (metabolites)
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).tickSize(0))
      .selectAll('text')
      .style('font-size', '10px')
      .text(d => String(d).replace(/_/g, ' '));

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
      .text('Metabolic Traits');

    // Add title
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${-margin.top / 2})`)
      .style('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Gene-Metabolic Trait Associations (GC GIMs)');

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
          .style('fill', 'white')
          .text('*');
          
        g.append('text')
          .attr('x', 20)
          .attr('y', 12)
          .style('font-size', '12px')
          .text('Causal');
      });

    // Clean up tooltip on unmount
    return () => {
      d3.select('.gc-gim-tooltip').remove();
    };

  }, [data, genes, metabolites, onAssociationClick]);

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

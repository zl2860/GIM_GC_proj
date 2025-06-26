import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface EffectEstimate {
  Gene: string;
  Trait: string;
  value: number;
  Group: string;
  is_causal: string | null;
}

interface LesionProgressionPlotProps {
  data: EffectEstimate[];
  onEstimateClick: (estimate: EffectEstimate) => void;
}

const LesionProgressionPlot: React.FC<LesionProgressionPlotProps> = ({ 
  data, 
  onEstimateClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 40, right: 100, bottom: 80, left: 200 };
    const width = Math.max(800, data.length * 8);
    const height = Math.max(600, data.length * 20);
    
    setDimensions({ width: width + margin.left + margin.right, height: height + margin.top + margin.bottom });

    const innerWidth = width;
    const innerHeight = height;

    // Group data by gene-trait combinations for stripe backgrounds
    const groupedData = d3.group(data, d => `${d.Gene}-${d.Trait}`);
    const uniqueCombinations = Array.from(groupedData.keys());

    // Create scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.value) as [number, number])
      .range([0, innerWidth])
      .nice();

    const yScale = d3.scaleBand()
      .domain(uniqueCombinations)
      .range([0, innerHeight])
      .padding(0.1);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'lesion-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .style('max-width', '300px');

    // Add alternating stripe backgrounds
    g.selectAll('.stripe')
      .data(uniqueCombinations)
      .enter()
      .append('rect')
      .attr('class', 'stripe')
      .attr('x', 0)
      .attr('y', d => yScale(d)!)
      .attr('width', innerWidth)
      .attr('height', yScale.bandwidth())
      .attr('fill', (d, i) => i % 2 === 0 ? '#f8f9fa' : '#ffffff')
      .attr('stroke', 'none');

    // Add vertical reference line at x=0
    g.append('line')
      .attr('x1', xScale(0))
      .attr('x2', xScale(0))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    // Create symbols for different estimate types
    const symbolGenerator = d3.symbol();

    // Add effect estimate points
    data.forEach(estimate => {
      const combination = `${estimate.Gene}-${estimate.Trait}`;
      const yPos = yScale(combination)! + yScale.bandwidth() / 2;
      const xPos = xScale(estimate.value);

      // Determine symbol and color based on the group/type
      let symbolType = d3.symbolCircle;
      let color = '#68AF78'; // Default green
      let size = 64;

      // For demonstration, we'll use different symbols for different groups
      // In real implementation, you'd have Beta.true, Beta.MR, Beta.pred data
      if (estimate.Group === 'C') {
        symbolType = d3.symbolCross; // Green cross for Beta.true
        color = '#68AF78';
      } else if (estimate.Group === 'CE') {
        symbolType = d3.symbolStar; // Dark green star for Beta.MR
        color = '#006632';
      } else if (estimate.Group === 'TG') {
        symbolType = d3.symbolTriangle; // Red triangle for Beta.pred
        color = '#FCD428';
      }

      // Highlight causal relationships
      if (estimate.is_causal === '*') {
        size = 96;
        // Add highlight circle
        g.append('circle')
          .attr('cx', xPos)
          .attr('cy', yPos)
          .attr('r', 8)
          .attr('fill', 'none')
          .attr('stroke', '#ff4444')
          .attr('stroke-width', 2)
          .attr('opacity', 0.7);
      }

      // Add the main symbol
      g.append('path')
        .attr('d', symbolGenerator.type(symbolType).size(size)())
        .attr('transform', `translate(${xPos}, ${yPos})`)
        .attr('fill', color)
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this).attr('opacity', 0.7);
          
          const tooltipContent = `
            <strong>${estimate.Gene} → ${estimate.Trait}</strong><br/>
            <strong>Effect Value:</strong> ${estimate.value.toFixed(4)}<br/>
            <strong>Group:</strong> ${estimate.Group}<br/>
            <strong>Causal:</strong> ${estimate.is_causal === '*' ? 'Yes' : 'No'}
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
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          tooltip.style('visibility', 'hidden');
        })
        .on('click', function() {
          onEstimateClick(estimate);
        });
    });

    // Add x-axis
    const xAxis = d3.axisBottom(xScale)
      .tickSize(-innerHeight)
      .tickFormat(d3.format('.2f'));

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('font-family', 'Helvetica, Arial, sans-serif');

    // Style grid lines
    g.selectAll('.x-axis .tick line')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 0.5);

    // Add y-axis labels (gene-trait combinations)
    g.selectAll('.y-label')
      .data(uniqueCombinations)
      .enter()
      .append('text')
      .attr('class', 'y-label')
      .attr('x', -10)
      .attr('y', d => yScale(d)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '7pt')
      .style('font-family', 'Helvetica, Arial, sans-serif')
      .style('fill', '#333')
      .text(d => {
        const [gene, trait] = d.split('-');
        return `${gene} → ${trait.replace(/_/g, ' ')}`;
      });

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 20})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-family', 'Helvetica, Arial, sans-serif')
      .style('font-weight', 'bold')
      .text('Effect Estimate Value');

    g.append('text')
      .attr('transform', `translate(${-margin.left + 20}, ${innerHeight / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-family', 'Helvetica, Arial, sans-serif')
      .style('font-weight', 'bold')
      .text('Gene → Metabolic Trait');

    // Add title
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${-margin.top / 2})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-family', 'Helvetica, Arial, sans-serif')
      .style('font-weight', 'bold')
      .text('Effect Estimates Comparison - Lesion Progression');

    // Add legend
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${innerWidth + 20}, 20)`);

    const legendData = [
      { label: 'Beta.true (C)', symbol: d3.symbolCross, color: '#68AF78' },
      { label: 'Beta.MR (CE)', symbol: d3.symbolStar, color: '#006632' },
      { label: 'Beta.pred (TG)', symbol: d3.symbolTriangle, color: '#FCD428' }
    ];

    const legendItems = legend.selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);

    legendItems.append('path')
      .attr('d', d => symbolGenerator.type(d.symbol).size(64)())
      .attr('fill', d => d.color)
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5);

    legendItems.append('text')
      .attr('x', 15)
      .attr('y', 5)
      .style('font-size', '10px')
      .style('font-family', 'Helvetica, Arial, sans-serif')
      .text(d => d.label);

    // Add causal indicator legend
    legend.append('g')
      .attr('transform', `translate(0, ${legendData.length * 25 + 10})`)
      .call(g => {
        g.append('circle')
          .attr('r', 8)
          .attr('fill', 'none')
          .attr('stroke', '#ff4444')
          .attr('stroke-width', 2);
          
        g.append('text')
          .attr('x', 15)
          .attr('y', 5)
          .style('font-size', '10px')
          .style('font-family', 'Helvetica, Arial, sans-serif')
          .text('Causal (*)');
      });

    // Clean up tooltip on unmount
    return () => {
      d3.select('.lesion-tooltip').remove();
    };

  }, [data, onEstimateClick]);

  return (
    <div className="w-full overflow-auto">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="border border-gray-200 rounded bg-white"
      />
    </div>
  );
};

export default LesionProgressionPlot;

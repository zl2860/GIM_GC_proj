import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface R2Data {
  metabolite: string;
  step: string;
  cumulative_R2: number;
  incremental_R2: number | null;
  is_GIM: number;
}

interface IncrementalR2ChartProps {
  data: R2Data[];
  gimMetabolites: string[];
  onDataPointClick: (entry: R2Data) => void;
}

const IncrementalR2Chart: React.FC<IncrementalR2ChartProps> = ({ 
  data, 
  gimMetabolites,
  onDataPointClick 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 60, right: 150, bottom: 100, left: 80 };
    const width = 900;
    const height = 600;
    
    setDimensions({ width: width + margin.left + margin.right, height: height + margin.top + margin.bottom });

    const innerWidth = width;
    const innerHeight = height;

    // Process data for stacked area chart
    const metabolites = [...new Set(data.map(d => d.metabolite))].sort();
    const steps = [
      'Base (intercept only)',
      'GIM', 
      'age',
      'sex',
      'drink_freq',
      'ethnicity_group',
      'ever_smoke',
      'BMI_avg',
      'center'
    ];

    // Create processed data for each metabolite
    const processedData = metabolites.map(metabolite => {
      const metaboliteData = data.filter(d => d.metabolite === metabolite);
      const stepsData: { [key: string]: number } = {};
      
      // Initialize with 0 for all steps
      steps.forEach(step => {
        stepsData[step] = 0;
      });
      
      // Fill in actual cumulative R² values
      metaboliteData.forEach(d => {
        if (steps.includes(d.step)) {
          stepsData[d.step] = d.cumulative_R2;
        }
      });

      return {
        metabolite,
        is_GIM: metaboliteData[0]?.is_GIM || 0,
        ...stepsData
      };
    });

    // Create scales
    const xScale = d3.scaleBand()
      .domain(metabolites)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d3.max(steps, step => d[step])) as number])
      .range([innerHeight, 0])
      .nice();

    // Color scale for steps
    const colorScale = d3.scaleOrdinal()
      .domain(steps)
      .range([
        '#f8f9fa', // Base - light gray
        '#dc3545', // GIM - red
        '#007bff', // age - blue
        '#28a745', // sex - green
        '#6f42c1', // drink_freq - purple
        '#fd7e14', // ethnicity_group - orange
        '#6c757d', // ever_smoke - gray
        '#ffc107', // BMI_avg - yellow
        '#e83e8c'  // center - pink
      ]);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'r2-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('z-index', '1000')
      .style('max-width', '300px');

    // Create stacked data
    const stackGenerator = d3.stack<any>()
      .keys(steps)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Create area generator
    const areaGenerator = d3.area<any>()
      .x(d => xScale(d.data.metabolite)! + xScale.bandwidth() / 2)
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    // Add background rectangles for GIM metabolites
    processedData.forEach(d => {
      if (d.is_GIM === 1) {
        g.append('rect')
          .attr('x', xScale(d.metabolite)!)
          .attr('y', 0)
          .attr('width', xScale.bandwidth())
          .attr('height', innerHeight)
          .attr('fill', '#ffe6e6')
          .attr('opacity', 0.3);
      }
    });

    // Add areas for each step
    g.selectAll('.area')
      .data(stackedData)
      .enter()
      .append('path')
      .attr('class', 'area')
      .attr('d', areaGenerator)
      .attr('fill', d => colorScale(d.key) as string)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1);
        
        const tooltipContent = `
          <strong>Step: ${d.key}</strong><br/>
          <strong>Average R²:</strong> ${d3.mean(d, dd => dd[1] - dd[0])?.toFixed(4)}
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
        d3.select(this).attr('opacity', 0.8);
        tooltip.style('visibility', 'hidden');
      });

    // Add points for GIM metabolites
    processedData.forEach(d => {
      if (d.is_GIM === 1) {
        // Add point at the final cumulative R² value
        const finalR2 = d3.max(steps, step => d[step]) || 0;
        
        g.append('circle')
          .attr('cx', xScale(d.metabolite)! + xScale.bandwidth() / 2)
          .attr('cy', yScale(finalR2))
          .attr('r', 4)
          .attr('fill', '#dc3545')
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            d3.select(this).attr('r', 6);
            
            const tooltipContent = `
              <strong>GIM Metabolite: ${d.metabolite.replace(/_/g, ' ')}</strong><br/>
              <strong>Final R²:</strong> ${finalR2.toFixed(4)}
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
            d3.select(this).attr('r', 4);
            tooltip.style('visibility', 'hidden');
          })
          .on('click', function() {
            // Find the corresponding data entry
            const entry = data.find(item => item.metabolite === d.metabolite && item.step === 'GIM');
            if (entry) {
              onDataPointClick(entry);
            }
          });

        // Add vertical label for GIM metabolite
        g.append('text')
          .attr('x', xScale(d.metabolite)! + xScale.bandwidth() / 2)
          .attr('y', innerHeight + 15)
          .attr('text-anchor', 'middle')
          .attr('transform', `rotate(90, ${xScale(d.metabolite)! + xScale.bandwidth() / 2}, ${innerHeight + 15})`)
          .style('font-size', '8px')
          .style('font-family', 'Arial, sans-serif')
          .style('fill', '#dc3545')
          .style('font-weight', 'bold')
          .text(d.metabolite.replace(/_/g, ' '));
      }
    });

    // Add x-axis
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => ''); // Empty labels since we use rotated text for GIMs

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    // Add y-axis
    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d3.format('.3f'));

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 20})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-family', 'Arial, sans-serif')
      .style('font-weight', 'bold')
      .text('Metabolic Traits (GIM traits labeled)');

    g.append('text')
      .attr('transform', `translate(${-margin.left + 20}, ${innerHeight / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-family', 'Arial, sans-serif')
      .style('font-weight', 'bold')
      .text('Cumulative R²');

    // Add title
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${-margin.top / 2})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-family', 'Arial, sans-serif')
      .style('font-weight', 'bold')
      .text('Incremental R² by Determinant Steps');

    // Add legend
    const legend = g.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${innerWidth + 20}, 20)`);

    const legendItems = legend.selectAll('.legend-item')
      .data(steps)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legendItems.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', d => colorScale(d) as string)
      .attr('stroke', '#333')
      .attr('stroke-width', 0.5);

    legendItems.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .style('font-size', '10px')
      .style('font-family', 'Arial, sans-serif')
      .text(d => d);

    // Add GIM indicator legend
    legend.append('g')
      .attr('transform', `translate(0, ${steps.length * 20 + 10})`)
      .call(g => {
        g.append('circle')
          .attr('cx', 6)
          .attr('cy', 6)
          .attr('r', 4)
          .attr('fill', '#dc3545')
          .attr('stroke', '#fff')
          .attr('stroke-width', 2);
          
        g.append('text')
          .attr('x', 18)
          .attr('y', 10)
          .style('font-size', '10px')
          .style('font-family', 'Arial, sans-serif')
          .text('GIM Metabolite');
      });

    // Clean up tooltip on unmount
    return () => {
      d3.select('.r2-tooltip').remove();
    };

  }, [data, gimMetabolites, onDataPointClick]);

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

export default IncrementalR2Chart;

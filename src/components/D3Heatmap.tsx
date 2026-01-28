import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

// --- TYPE DEFINITIONS ---
interface Item {
  id: string;
  label: string;
}

// Cell data can now include p-value or N count for the tooltip
export interface Cell {
  rowId: string;
  colId: string;
  value: number;
  pValue?: number;
  N?: number; // Number of pairs in a group
}

interface D3HeatmapProps {
  rows: Item[];
  columns: Item[];
  data: Cell[];
  onCellClick?: (row: Item, col: Item) => void;
  onCellMouseOver?: (event: React.MouseEvent, cell: Cell) => void;
  onCellMouseOut?: () => void;
}

const D3Heatmap: React.FC<D3HeatmapProps> = ({
  rows,
  columns,
  data,
  onCellClick,
  onCellMouseOver,
  onCellMouseOut,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // --- SETUP ---
    // Increased margins to prevent label cutoff
    const margin = { top: 250, right: 10, bottom: 10, left: 250 };
    const cellSize = 20; // Reduced from 30 to make cells smaller
    const width = columns.length * cellSize;
    const height = rows.length * cellSize;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .attr('viewBox', [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
      .attr('style', 'max-width: 100%; height: auto; font-size: 12px; font-family: sans-serif;');

    const g = svg.selectAll<SVGGElement, null>('g.matrix-container')
      .data([null])
      .join('g')
        .attr('class', 'matrix-container')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const rowMap = new Map(rows.map(r => [r.id, r]));
    const colMap = new Map(columns.map(c => [c.id, c]));

    // --- SCALES & TRANSITION ---
    const x = d3.scaleBand(columns.map(c => c.id), [0, width]).padding(0.05);
    const y = d3.scaleBand(rows.map(r => r.id), [0, height]).padding(0.05);
    
    // Using a more vibrant, opaque color scale
    const color = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(["#2166ac", "#f7f7f7", "#b2182b"]); // From ColorBrewer (Blue -> Gray -> Red)

    const t = svg.transition().duration(1500);

    // --- MOUSE EVENTS ---
    const mouseoverLabel = (_event: MouseEvent, d: Item) => {
        d3.selectAll<SVGTextElement, Item>('.row-label, .col-label')
          .classed('active', p => p.id === d.id);
    };
    const mouseoutLabel = () => {
        d3.selectAll('.row-label, .col-label').classed('active', false);
    };

    // --- RENDER AXES & LABELS ---
    g.selectAll<SVGGElement, Item>('.row')
      .data(rows, d => d.id)
      .join(
        enter => {
          const row = enter.append('g').attr('class', 'row');
          row.append('text')
             .attr('class', 'row-label')
             .attr('x', -6)
             .attr('text-anchor', 'end')
             .on('mouseover', mouseoverLabel)
             .on('mouseout', mouseoutLabel);
          return row;
        }
      )
      .call(row => row.select('text').text(d => d.label))
      .transition(t)
      .attr('transform', d => `translate(0, ${y(d.id)! + y.bandwidth() / 2})`);

    g.selectAll<SVGGElement, Item>('.column')
      .data(columns, d => d.id)
      .join(
        enter => {
          const col = enter.append('g').attr('class', 'column');
          col.append('text')
             .attr('class', 'col-label')
             .attr('transform', 'rotate(-90)')
             .attr('y', 6)
             .attr('text-anchor', 'start')
             .on('mouseover', mouseoverLabel)
             .on('mouseout', mouseoutLabel);
          return col;
        }
       )
      .call(col => col.select('text').text(d => d.label))
      .transition(t)
      .attr('transform', d => `translate(${x(d.id)! + x.bandwidth() / 2}, 0)`);

    // --- RENDER CELLS ---
    g.selectAll<SVGRectElement, Cell>('.cell')
      .data(data, d => `${d.rowId}-${d.colId}`)
      .join('rect')
      .attr('class', 'cell')
      .attr('fill', d => color(d.value))
      .style('cursor', onCellClick ? 'pointer' : 'default')
      .on('click', onCellClick ? (event, d) => {
        const row = rowMap.get(d.rowId);
        const col = colMap.get(d.colId);
        if (row && col) onCellClick(row, col);
      } : null)
      .on('mouseover', onCellMouseOver ? (event: React.MouseEvent, d) => onCellMouseOver(event, d) : null)
      .on('mouseout', onCellMouseOut || null)
      .transition(t)
      .attr('x', d => x(d.colId)!)
      .attr('y', d => y(d.rowId)!)
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth());
      
  }, [rows, columns, data, onCellClick, onCellMouseOver, onCellMouseOut]);

  return (
    <div>
        <style>{`
            .row-label.active,
            .col-label.active {
                fill: #e11d48;
                font-weight: bold;
            }
        `}</style>
        <svg ref={svgRef}></svg>
    </div>
  );
};

export default D3Heatmap;
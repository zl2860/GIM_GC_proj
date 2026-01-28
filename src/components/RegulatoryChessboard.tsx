import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';

interface RegulatoryPair {
  id: string;
  trait: string;
  regionLabel: string;
  availableCount: number;
  positiveCount: number;
  negativeCount: number;
  grade: number | null;
  maxAbsEffect?: number | null;
  gim?: string;
}

interface RegulatoryChessboardProps {
  data: RegulatoryPair[];
  onCellClick?: (region: string, trait: string) => void;
  selectedRegion?: string | null;
  selectedTrait?: string | null;
  gimFilter?: 'all' | 'Gastric cancer' | 'Gastric lesion progression';
}

type OrderType = 'name' | 'frequency' | 'grade' | 'cluster' | 'clusterRegions' | 'clusterTraits';

const RegulatoryChessboard: React.FC<RegulatoryChessboardProps> = ({
  data,
  onCellClick,
  selectedRegion,
  selectedTrait,
  gimFilter = 'all'
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [orderType, setOrderType] = useState<OrderType>('name');
  const [zoomLevel, setZoomLevel] = useState(1);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  // Filter data by GIM context
  // Note: Some pairs have gim === "Gastric cancer & Gastric lesion progression" and should appear in both contexts
  const filteredData = useMemo(() => {
    if (gimFilter === 'all') return data;
    
    return data.filter(d => {
      if (!d.gim) return false;
      const gim = d.gim;
      // Include pairs that match the filter OR pairs that belong to both contexts
      return gim === gimFilter || gim.includes('Gastric cancer & Gastric lesion progression');
    });
  }, [data, gimFilter]);

  // Calculate pairs count
  const pairsCount = useMemo(() => {
    return filteredData.length;
  }, [filteredData]);

  // Calculate ordering based on orderType
  const { regions, traits } = useMemo(() => {
    if (!filteredData.length) return { regions: [], traits: [] };

    const allRegions = Array.from(new Set(filteredData.map(d => d.regionLabel)));
    const allTraits = Array.from(new Set(filteredData.map(d => d.trait)));

    // Calculate frequencies
    const regionFreq = new Map<string, number>();
    const traitFreq = new Map<string, number>();
    filteredData.forEach(d => {
      regionFreq.set(d.regionLabel, (regionFreq.get(d.regionLabel) || 0) + 1);
      traitFreq.set(d.trait, (traitFreq.get(d.trait) || 0) + 1);
    });

    // Calculate average grade
    const regionGrade = new Map<string, number>();
    const traitGrade = new Map<string, number>();
    filteredData.forEach(d => {
      const grade = d.grade || 0;
      regionGrade.set(d.regionLabel, (regionGrade.get(d.regionLabel) || 0) + grade);
      traitGrade.set(d.trait, (traitGrade.get(d.trait) || 0) + grade);
    });
    regionGrade.forEach((sum, key) => {
      const count = regionFreq.get(key) || 1;
      regionGrade.set(key, sum / count);
    });
    traitGrade.forEach((sum, key) => {
      const count = traitFreq.get(key) || 1;
      traitGrade.set(key, sum / count);
    });

    let orderedRegions: string[];
    let orderedTraits: string[];

    switch (orderType) {
      case 'frequency':
        // Sort by number of pairs (most frequent first)
        orderedRegions = [...allRegions].sort((a, b) => {
          return (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0);
        });
        orderedTraits = [...allTraits].sort((a, b) => {
          return (traitFreq.get(b) || 0) - (traitFreq.get(a) || 0);
        });
        break;
      case 'grade':
        orderedRegions = [...allRegions].sort((a, b) => {
          return (regionGrade.get(b) || 0) - (regionGrade.get(a) || 0);
        });
        orderedTraits = [...allTraits].sort((a, b) => {
          return (traitGrade.get(b) || 0) - (traitGrade.get(a) || 0);
        });
        break;
      case 'cluster':
        // Cluster by GIM context (GC first, then progression, then both)
        const gcRegions = allRegions.filter(r => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.regionLabel === r && (gim === 'Gastric cancer' || gim.includes('Gastric cancer & Gastric lesion progression'));
          })
        );
        const progRegions = allRegions.filter(r => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.regionLabel === r && gim === 'Gastric lesion progression' && !gim.includes('&');
          })
        );
        const bothRegions = allRegions.filter(r => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.regionLabel === r && gim.includes('Gastric cancer & Gastric lesion progression');
          })
        );
        orderedRegions = [
          ...gcRegions.filter(r => !bothRegions.includes(r)).sort((a, b) => (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0)),
          ...bothRegions.sort((a, b) => (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0)),
          ...progRegions.sort((a, b) => (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0))
        ];
        orderedTraits = [...allTraits].sort((a, b) => (traitFreq.get(b) || 0) - (traitFreq.get(a) || 0));
        break;
      case 'clusterRegions':
        // Cluster regions by GIM context, traits by name
        const gcRegions2 = allRegions.filter(r => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.regionLabel === r && (gim === 'Gastric cancer' || gim.includes('Gastric cancer & Gastric lesion progression'));
          })
        );
        const progRegions2 = allRegions.filter(r => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.regionLabel === r && gim === 'Gastric lesion progression' && !gim.includes('&');
          })
        );
        const bothRegions2 = allRegions.filter(r => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.regionLabel === r && gim.includes('Gastric cancer & Gastric lesion progression');
          })
        );
        orderedRegions = [
          ...gcRegions2.filter(r => !bothRegions2.includes(r)).sort((a, b) => (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0)),
          ...bothRegions2.sort((a, b) => (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0)),
          ...progRegions2.sort((a, b) => (regionFreq.get(b) || 0) - (regionFreq.get(a) || 0))
        ];
        orderedTraits = [...allTraits].sort();
        break;
      case 'clusterTraits':
        // Cluster traits by GIM context, regions by name
        const gcTraits = allTraits.filter(t => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.trait === t && (gim === 'Gastric cancer' || gim.includes('Gastric cancer & Gastric lesion progression'));
          })
        );
        const progTraits = allTraits.filter(t => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.trait === t && gim === 'Gastric lesion progression' && !gim.includes('&');
          })
        );
        const bothTraits = allTraits.filter(t => 
          filteredData.some(d => {
            const gim = d.gim || '';
            return d.trait === t && gim.includes('Gastric cancer & Gastric lesion progression');
          })
        );
        orderedRegions = [...allRegions].sort();
        orderedTraits = [
          ...gcTraits.filter(t => !bothTraits.includes(t)).sort((a, b) => (traitFreq.get(b) || 0) - (traitFreq.get(a) || 0)),
          ...bothTraits.sort((a, b) => (traitFreq.get(b) || 0) - (traitFreq.get(a) || 0)),
          ...progTraits.sort((a, b) => (traitFreq.get(b) || 0) - (traitFreq.get(a) || 0))
        ];
        break;
      case 'name':
      default:
        orderedRegions = [...allRegions].sort();
        orderedTraits = [...allTraits].sort();
        break;
    }

    return { regions: orderedRegions, traits: orderedTraits };
  }, [filteredData, orderType]);

  // Color mapping based on grade with opacity based on maxAbsEffect
  // Colors: #bcbd22 (yellow-green), #9467bd (purple), #d62728 (red), #777777 (gray), #2ca02c (green)
  const getColor = (grade: number | null, maxAbsEffect: number | null | undefined): string => {
    if (grade === null || grade === 0) return '#f1f5f9'; // light gray for no data
    
    // Map grade to one of the 5 colors
    // Grade 6 -> red, Grade 5 -> purple, Grade 4 -> green, Grade 3 -> yellow-green, Grade 2/1 -> gray
    let baseColor: string;
    if (grade >= 6) {
      baseColor = '#d62728'; // red
    } else if (grade >= 5) {
      baseColor = '#9467bd'; // purple
    } else if (grade >= 4) {
      baseColor = '#2ca02c'; // green
    } else if (grade >= 3) {
      baseColor = '#bcbd22'; // yellow-green
    } else {
      baseColor = '#777777'; // gray
    }
    
    // Calculate opacity based on maxAbsEffect (normalize to 0.4-1.0 range)
    let opacity = 0.7; // default opacity
    if (maxAbsEffect !== null && maxAbsEffect !== undefined && maxAbsEffect > 0) {
      // Normalize maxAbsEffect to 0.4-1.0 range
      // Assuming maxAbsEffect typically ranges from 0 to ~0.5
      const normalized = Math.min(1, maxAbsEffect / 0.5);
      opacity = 0.4 + (normalized * 0.6); // range: 0.4 to 1.0
    }
    
    // Convert hex color to rgba with opacity
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  useEffect(() => {
    if (!svgRef.current || !filteredData.length || !containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = Math.max(800, container.clientWidth);
    const margin = { top: 80, right: 20, bottom: 100, left: 120 };
    
    // Calculate cell size
    const minCellSize = 8;
    const maxCellSize = 20;
    const cellSize = Math.max(
      minCellSize,
      Math.min(
        maxCellSize,
        Math.floor((containerWidth - margin.left - margin.right) / Math.max(traits.length, 1))
      )
    );

    const width = traits.length * cellSize;
    const height = regions.length * cellSize;
    const totalWidth = width + margin.left + margin.right;
    const totalHeight = height + margin.top + margin.bottom;

    setDimensions({ width: totalWidth, height: totalHeight });

    const svg = d3.select(svgRef.current);
    
    // Initialize SVG if needed
    if (svg.select('g.main-group').empty()) {
      svg
        .attr('width', totalWidth)
        .attr('height', totalHeight)
        .style('font-family', 'sans-serif')
        .style('font-size', '11px')
        .style('background', '#ffffff'); // white background
      
      gRef.current = svg.append('g').attr('class', 'main-group').attr('transform', `translate(${margin.left},${margin.top})`);
    } else {
      svg
        .attr('width', totalWidth)
        .attr('height', totalHeight);
    }

    const g = gRef.current!;

    // Create scales
    const xScale = d3.scaleBand().domain(traits).range([0, width]).padding(0);
    const yScale = d3.scaleBand().domain(regions).range([0, height]).padding(0);

    // Create data map
    const dataMap = new Map<string, RegulatoryPair>();
    filteredData.forEach(d => {
      const key = `${d.regionLabel}__${d.trait}`;
      dataMap.set(key, d);
    });

    // Create tooltip
    const tooltip = d3
      .select('body')
      .selectAll('.regulatory-chessboard-tooltip')
      .data([0])
      .join('div')
      .attr('class', 'regulatory-chessboard-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '10px 14px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)');

    // Create transition for smooth animations (slower for better visibility)
    const t = svg.transition().duration(1200).ease(d3.easeCubicInOut);

    // Create all possible cell combinations
    interface CellData {
      region: string;
      trait: string;
      pair: RegulatoryPair | null;
    }

    // Store CellData type reference for use in separate effect
    const CellDataType = {} as { region: string; trait: string; pair: RegulatoryPair | null };

    const allCells: CellData[] = [];
    regions.forEach(region => {
      traits.forEach(trait => {
        const key = `${region}__${trait}`;
        const pair = dataMap.get(key) || null;
        allCells.push({ region, trait, pair });
      });
    });

    // Update cells with smooth transitions
    const cells = g
      .selectAll<SVGGElement, CellData>('.cell-group')
      .data(allCells, d => `${d.region}__${d.trait}`)
      .join(
        enter => {
          const group = enter.append('g').attr('class', 'cell-group').attr('opacity', 0);
          group.append('rect').attr('class', 'cell');
          group.append('text').attr('class', 'cell-text');
          return group;
        },
        update => update,
        exit => exit.transition(t).attr('opacity', 0).remove()
      )
      .transition(t)
      .attr('opacity', 1)
      .attr('transform', d => `translate(${xScale(d.trait)!},${yScale(d.region)!})`);

    // Update rectangles
    cells.each(function(d: CellData) {
      const cellGroup = d3.select(this);
      const rect = cellGroup.select<SVGRectElement>('rect.cell');
      
      rect
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('fill', d.pair ? getColor(d.pair.grade, d.pair.maxAbsEffect) : '#f1f5f9')
        .attr('stroke', () => {
          const isSelected =
            (selectedRegion && selectedRegion === d.region) ||
            (selectedTrait && selectedTrait === d.trait);
          return isSelected ? '#60a5fa' : '#ffffff'; // soft blue for selection, white grid lines
        })
        .attr('stroke-width', () => {
          const isSelected =
            (selectedRegion && selectedRegion === d.region) ||
            (selectedTrait && selectedTrait === d.trait);
          return isSelected ? 2 : 1;
        })
        .style('cursor', d.pair && onCellClick ? 'pointer' : 'default')
        .on('mouseenter', function (this: SVGRectElement, event: any) {
          if (!d.pair) return;
          
          d3.select(this)
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 2);
          
          const pair = d.pair;
          const fraction = `${pair.availableCount}/${pair.availableCount}`;
          const gimContext = pair.gim || 'N/A';
          const mouseEvent = event as MouseEvent;
          tooltip
            .html(
              `<div style="font-weight: 600; margin-bottom: 6px; font-size: 13px;">${d.region} → ${d.trait}</div>
              <div style="margin-bottom: 3px;"><strong>GIM Context:</strong> ${gimContext}</div>
              <div style="margin-bottom: 3px;"><strong>Grade:</strong> ${pair.grade ?? 'N/A'}</div>
              <div style="margin-bottom: 3px;"><strong>Coverage:</strong> ${fraction}</div>
              <div><strong>Positive/Negative:</strong> ${pair.positiveCount}/${pair.negativeCount}</div>`
            )
            .style('opacity', 1)
            .style('left', `${mouseEvent.pageX + 12}px`)
            .style('top', `${mouseEvent.pageY - 10}px`);
        })
        .on('mouseleave', function (this: SVGRectElement) {
          if (!d.pair) return;
          
          const isSelected =
            (selectedRegion && selectedRegion === d.region) ||
            (selectedTrait && selectedTrait === d.trait);
          d3.select(this)
            .attr('stroke', isSelected ? '#60a5fa' : '#ffffff')
            .attr('stroke-width', isSelected ? 2 : 1);
          tooltip.style('opacity', 0);
        })
        .on('click', function (this: SVGRectElement, event: any) {
          const mouseEvent = event as MouseEvent;
          mouseEvent.stopPropagation();
          if (d.pair && onCellClick) {
            onCellClick(d.region, d.trait);
          }
        });
    });

    // Update text labels inside cells
    cells.select<SVGTextElement>('text.cell-text')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => {
        if (!d.pair) return '#cbd5e1';
        // Use white text for darker colors, dark text for lighter colors
        const grade = d.pair.grade;
        if (grade === null || grade === 0) return '#cbd5e1';
        if (grade >= 5) return '#ffffff';
        if (grade >= 3) return '#ffffff';
        return '#1f2937';
      })
      .attr('font-size', d => {
        const size = Math.min(xScale.bandwidth(), yScale.bandwidth());
        return `${Math.max(9, size * 0.5)}px`;
      })
      .attr('font-weight', '600')
      .text(d => {
        if (!d.pair) return '';
        return String(d.pair.grade || '');
      })
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.2)');

    // Update Y-axis labels with smooth transitions
    g.selectAll<SVGTextElement, string>('.y-axis-label')
      .data(regions, d => d)
      .join(
        enter => enter.append('text').attr('class', 'y-axis-label').attr('opacity', 0),
        update => update,
        exit => exit.transition(t).attr('opacity', 0).remove()
      )
      .attr('x', -8)
      .attr('y', d => yScale(d)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#374151')
      .attr('font-size', '11px')
      .text(d => d)
      .on('mouseenter', function (event, d: string) {
        d3.select(this).attr('font-weight', 'bold').attr('fill', '#3b82f6');
        g.selectAll<SVGGElement, CellData>('.cell-group')
          .filter(function(cell: CellData) { return cell.region === d && cell.pair !== null; })
          .select('rect')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 1.5);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('font-weight', 'normal').attr('fill', '#374151');
        g.selectAll<SVGGElement, CellData>('.cell-group')
          .select('rect')
          .attr('stroke', function (d: CellData) {
            if (!d.pair) return '#ffffff';
            const isSelected =
              (selectedRegion && selectedRegion === d.region) ||
              (selectedTrait && selectedTrait === d.trait);
            return isSelected ? '#60a5fa' : '#ffffff';
          })
          .attr('stroke-width', function (d: CellData) {
            if (!d.pair) return 1;
            const isSelected =
              (selectedRegion && selectedRegion === d.region) ||
              (selectedTrait && selectedTrait === d.trait);
            return isSelected ? 2 : 1;
          });
      })
      .transition(t)
      .attr('opacity', 1)
      .attr('y', d => yScale(d)! + yScale.bandwidth() / 2);

    // Update X-axis labels with smooth transitions
    g.selectAll<SVGTextElement, string>('.x-axis-label')
      .data(traits, d => d)
      .join(
        enter => enter.append('text').attr('class', 'x-axis-label').attr('opacity', 0),
        update => update,
        exit => exit.transition(t).attr('opacity', 0).remove()
      )
      .attr('x', d => xScale(d)! + xScale.bandwidth() / 2)
      .attr('y', height + 12)
      .attr('text-anchor', 'end')
      .attr('transform', d => {
        const x = xScale(d)! + xScale.bandwidth() / 2;
        return `rotate(-90, ${x}, ${height + 12})`;
      })
      .attr('fill', '#374151')
      .attr('font-size', '10px')
      .text(d => d)
      .on('mouseenter', function (event, d: string) {
        d3.select(this).attr('font-weight', 'bold').attr('fill', '#3b82f6');
        g.selectAll<SVGGElement, CellData>('.cell-group')
          .filter(function(cell: CellData) { return cell.trait === d && cell.pair !== null; })
          .select('rect')
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 1.5);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('font-weight', 'normal').attr('fill', '#374151');
        g.selectAll<SVGGElement, CellData>('.cell-group')
          .select('rect')
          .attr('stroke', function (d: CellData) {
            if (!d.pair) return '#ffffff';
            const isSelected =
              (selectedRegion && selectedRegion === d.region) ||
              (selectedTrait && selectedTrait === d.trait);
            return isSelected ? '#60a5fa' : '#ffffff';
          })
          .attr('stroke-width', function (d: CellData) {
            if (!d.pair) return 1;
            const isSelected =
              (selectedRegion && selectedRegion === d.region) ||
              (selectedTrait && selectedTrait === d.trait);
            return isSelected ? 2 : 1;
          });
      })
      .transition(t)
      .attr('opacity', 1)
      .attr('x', d => xScale(d)! + xScale.bandwidth() / 2);

    // Update axis titles
    let titleX = svg.select('.title-x');
    if (titleX.empty()) {
      titleX = svg.append('text').attr('class', 'title-x');
    }
    titleX
      .attr('x', margin.left + width / 2)
      .attr('y', margin.top - 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .text('Metabolomic Traits');

    let titleY = svg.select('.title-y');
    if (titleY.empty()) {
      titleY = svg.append('text').attr('class', 'title-y');
    }
    titleY
      .attr('x', 15)
      .attr('y', margin.top + height / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `rotate(-90, 15, ${margin.top + height / 2})`)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .text('Genomic Regions');

    // Cleanup tooltip on unmount
    return () => {
      tooltip.remove();
    };
  }, [filteredData, regions, traits, onCellClick, orderType, zoomLevel]);

  // Separate effect to update selection highlights without triggering full re-render
  useEffect(() => {
    if (!gRef.current || !svgRef.current) return;
    
    const g = gRef.current;
    // Update only stroke attributes, no transition to avoid flicker
    g.selectAll<SVGGElement, any>('.cell-group')
      .each(function(d: any) {
        if (!d || typeof d !== 'object') return;
        const rect = d3.select(this).select<SVGRectElement>('rect.cell');
        if (!rect.node()) return;
        const isSelected =
          (selectedRegion && selectedRegion === d.region) ||
          (selectedTrait && selectedTrait === d.trait);
        // Update without transition to avoid flicker
        rect
          .attr('stroke', isSelected ? '#60a5fa' : '#ffffff')
          .attr('stroke-width', isSelected ? 2 : 1);
      });
  }, [selectedRegion, selectedTrait]);

  return (
    <div className="w-full">
      {/* Display pairs count */}
      <div className="mb-2 text-sm font-semibold text-slate-700 text-center">
        Showing {pairsCount} regulatory pair{pairsCount !== 1 ? 's' : ''}
      </div>
      
      <div ref={containerRef} className="w-full overflow-auto flex justify-center">
        <div className="relative inline-block" style={{ minWidth: '100%' }}>
          {/* Fixed position controls - top left for Order, top right for Zoom */}
          <div className="absolute top-2 left-2 flex gap-2 bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-slate-300 z-10">
            <label className="text-xs font-semibold text-slate-700 flex items-center">Order:</label>
            <select
              value={orderType}
              onChange={e => setOrderType(e.target.value as OrderType)}
              className="text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded px-2 py-1 cursor-pointer hover:bg-slate-50"
            >
              <option value="name">by Name</option>
              <option value="frequency">by Number of Pairs</option>
              <option value="grade">by Grade</option>
              <option value="cluster">by GIM Context</option>
              <option value="clusterRegions">Cluster Regions by GIM</option>
              <option value="clusterTraits">Cluster Traits by GIM</option>
            </select>
          </div>
          <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
          <div className="absolute top-2 right-2 flex gap-2 bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-slate-300 z-10">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
              className="px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors min-w-[36px]"
              title="Zoom out"
            >
              −
            </button>
            <span className="px-3 py-1.5 text-sm font-semibold text-slate-700 min-w-[50px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
              className="px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors min-w-[36px]"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegulatoryChessboard;

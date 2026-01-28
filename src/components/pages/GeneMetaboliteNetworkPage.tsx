// src/components/pages/GeneMetaboliteNetworkPage.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as d3 from 'd3';
import toast from 'react-hot-toast';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Button } from '../ui/button';

// Add interfaces for ColocNetwork
interface ColocNodeData {
  node: string;
  Group: string;
  node_type: string;
  hit1?: string;
  hit2?: string;
  'PP.H0.abf'?: string;
  'PP.H1.abf'?: string;
  'PP.H2.abf'?: string;
  'PP.H3.abf'?: string;
  'PP.H4.abf'?: string;
  GENE?: string;
  SNP?: string;
  Description?: string;
  qtl_type?: string;
  mean_degree?: string;
  mean_betweenness?: string;
  id: string;
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
}

interface ColocLinkData {
  source: ColocNodeData;
  target: ColocNodeData;
  value: number;
  data_source: string;
  qtl_type: string;
}

interface RawNode {
  id: string;
  group: string;
  index: number;
}
interface RawLink {
  source: number;
  target: number;
  value: number;
}
interface NetworkJSON {
  nodes: RawNode[];
  links: RawLink[];
}
interface NodeDatum extends RawNode {
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
}
interface LinkDatum {
  source: NodeDatum;
  target: NodeDatum;
  value: number;
}

// Enhanced color palette with better contrast and visual appeal
const colorPalette = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6'  // Teal
];

const GeneMetaboliteNetworkPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ggmSvgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [links, setLinks] = useState<LinkDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDatum|null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [networkType, setNetworkType] = useState<'ggm' | 'coloc'>('ggm');
  
  // Colocalization network states
  const colocSvgRef = useRef<SVGSVGElement>(null);
  const [colocNodes, setColocNodes] = useState<ColocNodeData[]>([]);
  const [colocLinks, setColocLinks] = useState<ColocLinkData[]>([]);
  const [colocLoading, setColocLoading] = useState(true);
  const [colocError, setColocError] = useState<string|null>(null);
  const [selectedColocNode, setSelectedColocNode] = useState<ColocNodeData|null>(null);
  const [colocSearchTerm, setColocSearchTerm] = useState('');
  const [autoNodeNames, setAutoNodeNames] = useState<string[]>([]);
  const [autoNetworkQuery, setAutoNetworkQuery] = useState<string>('');
  const variantDataCache = useRef<any[] | null>(null);
  const cslLociCache = useRef<any[] | null>(null);
  const colocSupplementCache = useRef<any[] | null>(null);
  const [colocSupplement, setColocSupplement] = useState<any[]>([]);

  const gatherNodeNamesForQuery = useCallback(async (query: string) => {
    const normalized = query.toLowerCase();
    const nodeSet = new Set<string>();
    const includeNode = (value?: string | null) => {
      if (value && value.trim()) {
        nodeSet.add(value.trim());
      }
    };

    try {
      // Supplemental colocalization data (takes precedence if overlaps)
      if (!colocSupplementCache.current) {
        const resp = await fetch(`${import.meta.env.BASE_URL}data/coloc_supplement.json`);
        const json = await resp.json();
        colocSupplementCache.current = Array.isArray(json) ? json : [];
      }

      if (normalized.startsWith('rs')) {
        (colocSupplementCache.current || []).forEach((row: any) => {
          const h1 = row.hit1?.toLowerCase();
          const h2 = row.hit2?.toLowerCase();
          if (h1 === normalized || h2 === normalized) {
            includeNode(row.gene);
            includeNode(row.trait);
          }
        });
      }

      if (/^\d/.test(normalized) || normalized.includes('q')) {
        (colocSupplementCache.current || []).forEach((row: any) => {
          const region = row.region?.toLowerCase();
          if (region && region.includes(normalized)) {
            includeNode(row.gene);
            includeNode(row.trait);
          }
        });
      }

      if (normalized.startsWith('rs')) {
        if (!variantDataCache.current) {
          const response = await fetch(`${import.meta.env.BASE_URL}data/matched_variants_2026.json`);
          const json = await response.json();
          variantDataCache.current = Array.isArray(json.data) ? json.data : [];
        }
        (variantDataCache.current || []).forEach((row: any) => {
          const reported = row.reportedVariant?.toLowerCase();
          if (reported && reported.includes(normalized)) {
            includeNode(row.nearestGene);
            includeNode(row.Metabolite);
            includeNode(row.Biomarker);
            includeNode(row.Exposure);
            includeNode(row.ID);
          }
        });
      }

      if (/^\d/.test(normalized) || normalized.includes('q')) {
        if (!cslLociCache.current) {
          const response = await fetch(`${import.meta.env.BASE_URL}data/csl_loci_2026.json`);
          const json = await response.json();
          cslLociCache.current = Array.isArray(json.data) ? json.data : [];
        }
        (cslLociCache.current || []).forEach((geneData: any) => {
          const geneName = geneData.gene;
          geneData.trait_groups?.forEach((group: any) => {
            group.traits?.forEach((trait: any) => {
              trait.regions?.forEach((region: string) => {
                if (region?.toLowerCase().includes(normalized)) {
                  includeNode(geneName);
                  includeNode(trait.metabolomic_trait);
                }
              });
            });
          });
        });
      }
    } catch (err) {
      console.error('Auto node resolution failed', err);
    }

    return Array.from(nodeSet);
  }, []);

  const isVariantOrRegionQuery = (normalized: string) =>
    normalized.startsWith('rs') || /^\d/.test(normalized) || normalized.includes('q');

  // Autofill from query param ?q=
  useEffect(() => {
    const rawQuery = searchParams.get('q')?.trim();
    const networkPref = searchParams.get('network');
    if (rawQuery) {
      setSearchTerm(rawQuery);
      setColocSearchTerm(rawQuery);
      const normalized = rawQuery.toLowerCase();
      const looksVariantOrRegion = isVariantOrRegionQuery(normalized);
      if (networkPref === 'coloc' || networkPref === 'ggm') {
        setNetworkType(networkPref);
      } else {
        setNetworkType(looksVariantOrRegion ? 'coloc' : 'ggm');
      }
    } else {
      setAutoNetworkQuery('');
      setAutoNodeNames([]);
    }
  }, [searchParams]);

  useEffect(() => {
    const rawQuery = searchParams.get('q')?.trim();
    if (!rawQuery) {
      setAutoNetworkQuery('');
      setAutoNodeNames([]);
      return;
    }
    const normalized = rawQuery.toLowerCase();
    const looksVariantOrRegion = isVariantOrRegionQuery(normalized);
    if (!looksVariantOrRegion && networkType !== 'coloc') {
      setAutoNetworkQuery('');
      setAutoNodeNames([]);
      return;
    }
    if (networkType !== 'coloc') return;
    if (autoNetworkQuery === normalized) {
      return;
    }

    (async () => {
      const nodeNames = await gatherNodeNamesForQuery(rawQuery);
      setAutoNodeNames(nodeNames);
      setAutoNetworkQuery(normalized);
      if (nodeNames.length) {
        setColocSearchTerm(nodeNames[0]);
      }
    })();
  }, [searchParams, networkType, autoNetworkQuery, gatherNodeNamesForQuery]);

  useEffect(() => {
    if (!autoNodeNames.length || !colocNodes.length) return;
    const normalizedTargets = autoNodeNames.map((name) => name.toLowerCase());
    const match = colocNodes.find((node) =>
      normalizedTargets.includes(node.node.toLowerCase())
    );
    if (match && match.id !== selectedColocNode?.id) {
      setSelectedColocNode(match);
    }
  }, [autoNodeNames, colocNodes, selectedColocNode]);

  const getSupplementForNode = React.useCallback(
    (node: ColocNodeData | null) => {
      if (!node || !colocSupplement?.length) return [];
      const key = node.node.toLowerCase();
      if (node.node_type === 'Gene') {
        return colocSupplement.filter(
          (row: any) => typeof row.gene === 'string' && row.gene.toLowerCase() === key
        );
      }
      return colocSupplement.filter(
        (row: any) => typeof row.trait === 'string' && row.trait.toLowerCase() === key
      );
    },
    [colocSupplement]
  );

  // load data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/GIM_ggm_network.json`)
      .then(res => {
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        return res.json() as Promise<NetworkJSON>;
      })
      .then(raw => {
        const nd = raw.nodes.map(n => ({
          ...n,
          x: Math.random() * 100,
          y: Math.random() * 100,
          fx: null,
          fy: null
        }));
        const ld = raw.links
          .filter(l => l.value !== 0)
          .map(l => ({
            source: nd[l.source],
            target: nd[l.target],
            value: l.value
          }));
        setNodes(nd);
        setLinks(ld);
      })
      .catch(err => {
        console.error(err);
        setError('Could not load network data');
        toast.error('Could not load network data');
      })
      .finally(() => setLoading(false));
  }, []);

  // Load colocalization data
  useEffect(() => {
    const loadColocData = async () => {
      try {
        // Load nodes
        const nodesResponse = await fetch(`${import.meta.env.BASE_URL}data/coloc_network_webpage_nodes_df.csv`);
        const nodesText = await nodesResponse.text();
        const nodesData = d3.csvParse(nodesText);
        
        // Load edges
        const edgesResponse = await fetch(`${import.meta.env.BASE_URL}data/coloc_network_webpage_edges_df.csv`);
        const edgesText = await edgesResponse.text();
        const edgesData = d3.csvParse(edgesText);

        // Process nodes - remove duplicates by node name
        const nodeMap = new Map();
        nodesData.forEach((node: any) => {
          if (!nodeMap.has(node.node)) {
            nodeMap.set(node.node, {
              ...node,
              id: node.node,
              x: Math.random() * 800,
              y: Math.random() * 600,
              fx: null,
              fy: null
            });
          }
        });
        
        const processedNodes = Array.from(nodeMap.values());

        // Create node lookup
        const nodeLookup = new Map(processedNodes.map((n: any) => [n.id, n]));

        // Process edges
        const processedLinks = edgesData
          .filter((edge: any) => {
            const hasFrom = nodeLookup.has(edge.from);
            const hasTo = nodeLookup.has(edge.to);
            return hasFrom && hasTo;
          })
          .map((edge: any) => ({
            source: nodeLookup.get(edge.from),
            target: nodeLookup.get(edge.to),
            value: parseFloat(edge.value),
            data_source: edge.data_source,
            qtl_type: edge.qtl_type
          }));

        setColocNodes(processedNodes);
        setColocLinks(processedLinks);
      } catch (err) {
        console.error(err);
        setColocError('Could not load colocalization network data');
        toast.error('Could not load colocalization network data');
      } finally {
        setColocLoading(false);
      }
    };

    loadColocData();
  }, []);

  // Load supplemental colocalization hits (priority data)
  useEffect(() => {
    const loadSupplement = async () => {
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data/coloc_supplement.json`);
        const json = await resp.json();
        const arr = Array.isArray(json) ? json : [];
        setColocSupplement(arr);
        colocSupplementCache.current = arr;
      } catch (err) {
        console.error('Failed to load supplemental coloc data', err);
      }
    };
    loadSupplement();
  }, []);

  // draw GGM network
  useEffect(() => {
    if (loading || error || !ggmSvgRef.current || nodes.length === 0 || networkType !== 'ggm') return;

    const svgEl = ggmSvgRef.current;
    const { width: renderedWidth, height: renderedHeight } = svgEl.getBoundingClientRect();
    const width = renderedWidth || svgEl.clientWidth || svgEl.parentElement?.clientWidth || 600;
    const height = renderedHeight || svgEl.clientHeight || 600;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.attr('width', width).attr('height', height);

    const gZoom = svg.append('g');
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', e => gZoom.attr('transform', e.transform)));

    const colorScale = d3.scaleOrdinal<string, string>()
      .domain(nodes.map(d => d.group))
      .range(colorPalette);

    // simulation
    const simulation = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).distance(120).strength(1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // links - enhanced styling
    const linkSel = gZoom.append('g')
      .attr('stroke', '#94a3b8')
      .selectAll<SVGLineElement, LinkDatum>('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-opacity', d => 0.3 + Math.min(0.4, Math.abs(d.value) * 0.5))
      .attr('stroke-width', d => 1 + Math.sqrt(Math.abs(d.value)) * 0.8)
      .attr('stroke-dasharray', d => d.value < 0 ? '3,3' : '0');

    // tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class','network-tooltip')
      .style('position','absolute')
      .style('padding','8px 12px')
      .style('background','rgba(15, 23, 42, 0.9)')
      .style('color','#fff')
      .style('border-radius','6px')
      .style('font-size','12px')
      .style('pointer-events','none')
      .style('opacity',0)
      .style('box-shadow', '0 4px 6px rgba(0,0,0,0.1)');

    // drag handlers
    function dragstarted(event: any, d: NodeDatum) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event: any, d: NodeDatum) {
      d.fx = event.x; d.fy = event.y;
    }
    function dragended(event: any, d: NodeDatum) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    // nodes filtered by search
    const filtered = nodes.filter(d =>
      d.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate node sizes based on degree (number of connections)
    const nodeDegrees = new Map<string, number>();
    links.forEach(l => {
      nodeDegrees.set(l.source.id, (nodeDegrees.get(l.source.id) || 0) + 1);
      nodeDegrees.set(l.target.id, (nodeDegrees.get(l.target.id) || 0) + 1);
    });

    // draw nodes - enhanced with different shapes and sizes
    const nodeSel = gZoom.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .selectAll('g')
      .data(filtered)
      .enter().append('g')
      .call(d3.drag<SVGGElement, NodeDatum>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('mouseover', function(e, d) {
        d3.select(this).select('circle, polygon').attr('stroke-width', 3);
        const degree = nodeDegrees.get(d.id) || 0;
        tooltip
          .html(`<strong>${d.id}</strong><br/>Group: ${d.group}<br/>Connections: ${degree}`)
          .style('left', (e.pageX + 8) + 'px')
          .style('top', (e.pageY + 8) + 'px')
          .transition().duration(150).style('opacity', 1);
      })
      .on('mouseout', function() {
        d3.select(this).select('circle, polygon').attr('stroke-width', 2);
        tooltip.transition().duration(150).style('opacity', 0);
      })
      .on('click', (_, d) => setSelectedNode(d));

    // Add node shapes - use different shapes for different groups
    const groupShapes = new Map<string, string>();
    const uniqueGroups = Array.from(new Set(nodes.map(n => n.group)));
    uniqueGroups.forEach((group, idx) => {
      groupShapes.set(group, idx % 3 === 0 ? 'circle' : idx % 3 === 1 ? 'square' : 'diamond');
    });

    nodeSel.each(function(d) {
      const shape = groupShapes.get(d.group) || 'circle';
      const degree = nodeDegrees.get(d.id) || 0;
      const baseRadius = 8;
      const radius = baseRadius + Math.min(6, degree * 0.5);
      const color = colorScale(d.group);
      
      if (shape === 'circle') {
        d3.select(this).append('circle')
          .attr('r', radius)
          .attr('fill', color)
          .attr('opacity', 0.9);
      } else if (shape === 'square') {
        const size = radius * 1.4;
        d3.select(this).append('rect')
          .attr('x', -size)
          .attr('y', -size)
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('fill', color)
          .attr('opacity', 0.9)
          .attr('transform', 'rotate(45)');
      } else { // diamond
        const size = radius * 1.3;
        d3.select(this).append('polygon')
          .attr('points', `0,-${size} ${size},0 0,${size} -${size},0`)
          .attr('fill', color)
          .attr('opacity', 0.9);
      }
    });

    // draw labels - enhanced styling
    const labelSel = gZoom.append('g')
      .selectAll('text')
      .data(filtered)
      .enter().append('text')
      .text(d => d.id)
      .attr('font-size', d => {
        const degree = nodeDegrees.get(d.id) || 0;
        return 9 + Math.min(3, degree * 0.3); // Scale font size based on degree
      })
      .attr('fill', '#1e293b')
      .attr('font-weight', '500')
      .attr('dx', d => {
        const shape = groupShapes.get(d.group) || 'circle';
        const degree = nodeDegrees.get(d.id) || 0;
        const radius = 8 + Math.min(6, degree * 0.5);
        return radius + 6;
      })
      .attr('dy', '0.31em')
      .attr('text-anchor', 'start')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // tick updates
    simulation.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x!)
        .attr('y1', d => d.source.y!)
        .attr('x2', d => d.target.x!)
        .attr('y2', d => d.target.y!);
      nodeSel
        .attr('transform', d => `translate(${d.x},${d.y})`);
      labelSel
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
      svg.selectAll('*').remove();
    };
  }, [loading, error, nodes, links, searchTerm, networkType]);

  // Draw colocalization network
  useEffect(() => {
    if (colocLoading || colocError || !colocSvgRef.current || colocNodes.length === 0 || networkType !== 'coloc') return;

    const svgEl = colocSvgRef.current;
    const { width: renderedWidth, height: renderedHeight } = svgEl.getBoundingClientRect();
    const width = renderedWidth || svgEl.clientWidth || svgEl.parentElement?.clientWidth || 600;
    const height = renderedHeight || svgEl.clientHeight || 600;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.attr('width', width).attr('height', height);

    const gZoom = svg.append('g');
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', e => gZoom.attr('transform', e.transform)));

    // Color scales
    const nodeColorScale = d3.scaleOrdinal<string, string>()
      .domain(['Gene', 'GIM Biomarkers'])
      .range(['#6c408e', '#ece399']);

    // Enhanced edge color scale - distinguish sQTL and eQTL for coloc
    const edgeColorScale = (dataSource: string, qtlType?: string) => {
      if (dataSource === 'PPI') return '#2ED573';
      if (dataSource === 'ggm') return '#3742FA';
      if (dataSource === 'coloc') {
        // Different colors for sQTL and eQTL
        if (qtlType?.toLowerCase() === 'sqtl') return '#FF6B9D'; // Pink for sQTL
        if (qtlType?.toLowerCase() === 'eqtl') return '#FF4757'; // Red for eQTL
        return '#FF4757'; // Default red for coloc
      }
      return '#94a3b8';
    };

    // Create simulation
    const simulation = d3.forceSimulation<ColocNodeData>(colocNodes)
      .force('link', d3.forceLink<ColocNodeData, ColocLinkData>(colocLinks).distance(120).strength(1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Draw links - enhanced styling with sQTL/eQTL distinction
    const linkSel = gZoom.append('g')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(colocLinks)
      .enter().append('line')
      .attr('stroke', (d: any) => edgeColorScale(d.data_source, d.qtl_type))
      .attr('stroke-width', (d: any) => {
        // Vary width based on connection strength/value
        return 1.5 + Math.min(1.5, Math.abs(d.value || 0) * 2);
      })
      .attr('stroke-dasharray', (d: any) => {
        // Different dash patterns for different data sources
        if (d.data_source === 'PPI') return '5,3';
        if (d.data_source === 'ggm') return '3,3';
        // For coloc, use different patterns for sQTL and eQTL
        if (d.data_source === 'coloc') {
          if (d.qtl_type?.toLowerCase() === 'sqtl') return '4,2'; // Dashed for sQTL
          return '0'; // Solid line for eQTL
        }
        return '0';
      });

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class','network-tooltip')
      .style('position','absolute')
      .style('padding','6px 10px')
      .style('background','rgba(0,0,0,0.7)')
      .style('color','#fff')
      .style('border-radius','4px')
      .style('font-size','12px')
      .style('pointer-events','none')
      .style('opacity',0);

    // Drag handlers
    function dragstarted(event: any, d: ColocNodeData) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event: any, d: ColocNodeData) {
      d.fx = event.x; d.fy = event.y;
    }
    function dragended(event: any, d: ColocNodeData) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    // Filter nodes by search term
    const filteredColocNodes = colocNodes.filter(d =>
      d.node.toLowerCase().includes(colocSearchTerm.toLowerCase())
    );

    // Draw nodes - enhanced styling with different shapes
    const nodeSel = gZoom.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .selectAll('g')
      .data(filteredColocNodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, ColocNodeData>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('mouseover', function(e, d) {
        d3.select(this).select('circle, rect').attr('stroke-width', 3);
        let tooltipHtml = `<strong>${d.node}</strong>`;
        if (d.mean_degree) tooltipHtml += `<br/>Degree: ${d.mean_degree}`;
        if (d.mean_betweenness) tooltipHtml += `<br/>Betweenness: ${parseFloat(d.mean_betweenness).toFixed(2)}`;
        if (d.qtl_type) tooltipHtml += `<br/>QTL Type: ${formatQTLType(d.qtl_type)}`;
        
        tooltip
          .html(tooltipHtml)
          .style('left', (e.pageX + 8) + 'px')
          .style('top', (e.pageY + 8) + 'px')
          .transition().duration(150).style('opacity', 1);
      })
      .on('mouseout', function() {
        d3.select(this).select('circle, rect').attr('stroke-width', 2);
        tooltip.transition().duration(150).style('opacity', 0);
      })
      .on('click', (_, d) => setSelectedColocNode(d));

    // Add node shapes - circles for genes, squares for biomarkers
    nodeSel.each(function(d: any) {
      const degree = parseFloat(d.mean_degree || '0');
      const radius = Math.max(10, Math.min(22, 10 + degree * 1.2));
      const color = nodeColorScale(d.node_type);
      const isGene = d.node_type === 'Gene';
      
      if (isGene) {
        // Circles for genes
        d3.select(this).append('circle')
          .attr('r', radius)
          .attr('fill', color)
          .attr('opacity', 0.85);
      } else {
        // Squares for biomarkers
        const size = radius * 1.2;
        d3.select(this).append('rect')
          .attr('x', -size)
          .attr('y', -size)
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('rx', 3)
          .attr('fill', color)
          .attr('opacity', 0.85);
      }
    });

    // Draw labels - enhanced styling
    const labelSel = gZoom.append('g')
      .selectAll('text')
      .data(filteredColocNodes)
      .enter().append('text')
      .text((d: any) => d.node)
      .attr('font-size', (d: any) => {
        const degree = parseFloat(d.mean_degree || '0');
        return 9 + Math.min(2, degree * 0.2);
      })
      .attr('fill', '#1e293b')
      .attr('font-weight', '500')
      .attr('dx', (d: any) => {
        const degree = parseFloat(d.mean_degree || '0');
        const radius = Math.max(10, Math.min(22, 10 + degree * 1.2));
        return radius + 6;
      })
      .attr('dy', '0.31em')
      .attr('text-anchor', 'start')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Tick updates
    simulation.on('tick', () => {
      linkSel
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      nodeSel
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
      labelSel
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
      svg.selectAll('*').remove();
    };
  }, [colocLoading, colocError, colocNodes, colocLinks, networkType, colocSearchTerm]);

  const top5 = React.useMemo(() => {
    if (!selectedNode) return [];
    return links
      .filter(l => l.source.id === selectedNode.id || l.target.id === selectedNode.id)
      .map(l => {
        const other = l.source.id === selectedNode.id ? l.target : l.source;
        return { id: other.id, group: other.group, value: l.value };
      })
      .sort((a,b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0,5);
  }, [selectedNode, links]);

  // Colocalization connected nodes with pagination
  const [colocPage, setColocPage] = useState(1);
  const colocItemsPerPage = 8; // Show 8 items per page
  
  const colocConnectedNodes = React.useMemo(() => {
    if (!selectedColocNode) return [];
    return colocLinks
      .filter(l => l.source.id === selectedColocNode.id || l.target.id === selectedColocNode.id)
      .map(l => {
        const other = l.source.id === selectedColocNode.id ? l.target : l.source;
        return { 
          node: other, 
          value: l.value, 
          data_source: l.data_source, 
          qtl_type: l.qtl_type 
        };
      })
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [selectedColocNode, colocLinks]);

  const colocTotalPages = Math.ceil(colocConnectedNodes.length / colocItemsPerPage);
  const colocPaginatedNodes = colocConnectedNodes.slice(
    (colocPage - 1) * colocItemsPerPage,
    colocPage * colocItemsPerPage
  );

  // Reset page when selected node changes
  React.useEffect(() => {
    setColocPage(1);
  }, [selectedColocNode]);

  // Get colocalization information for traits
  const getTraitColocalizationInfo = (node: ColocNodeData) => {
    if (node.node_type !== 'GIM Biomarkers') return null;
    
    const traitColocLinks = colocLinks.filter(l => 
      (l.source.id === node.id || l.target.id === node.id) && 
      l.data_source === 'coloc'
    );
    
    return traitColocLinks.map(l => {
      const gene = l.source.id === node.id ? l.target : l.source;
      return {
        gene: gene.node,
        geneGroup: gene.Group,
        pp4: l.value,
        qtl_type: l.qtl_type
      };
    }).sort((a, b) => b.pp4 - a.pp4);
  };

  // Helper function to format QTL type
  const formatQTLType = (qtlType: string) => {
    if (!qtlType) return '';
    const lower = qtlType.toLowerCase();
    if (lower === 'eqtl') return 'eQTL';
    if (lower === 'sqtl') return 'sQTL';
    return qtlType;
  };

  // Helper function to format PP value
  const formatPPValue = (ppValue: string | undefined) => {
    if (!ppValue) return '';
    // Convert PP.H4.abf to PP H4
    return ppValue.replace(/PP\.(H\d+)\.abf/i, 'PP $1');
  };

  // Helper function to get connected type display text
  const getConnectedTypeText = (dataSource: string, qtlType: string) => {
    if (dataSource === 'PPI') return 'Protein-protein interaction';
    if (dataSource === 'ggm') return 'Partial correlation derived from GGM';
    if (dataSource === 'coloc') {
      const formattedQTL = formatQTLType(qtlType);
      if (formattedQTL) return `Colocalization via ${formattedQTL}`;
      return 'Colocalization';
    }
    return `${dataSource} (${formatQTLType(qtlType)})`;
  };

  if (loading) return (
    <div className="flex justify-center p-4 sm:p-6">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-b-transparent rounded-full"/>
    </div>
  );
  if (error) return <div className="p-4 sm:p-6 text-red-600">{error}</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="rounded-lg bg-white p-4 sm:p-6 shadow">
        <h1 className="text-2xl font-bold mb-2">Network Visualization</h1>
        <p className="text-gray-700 mb-4">
          Explore different types of networks: GGM partial correlations and colocalization networks.
          Drag nodes to explore, and click to inspect connections.
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant={networkType === 'ggm' ? 'default' : 'outline'}
            onClick={() => setNetworkType('ggm')}
          >
            GGM Network
          </Button>
          <Button
            variant={networkType === 'coloc' ? 'default' : 'outline'}
            onClick={() => setNetworkType('coloc')}
          >
            Colocalization Network
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7 lg:min-h-[600px]">
          {networkType === 'ggm' ? (
            <>
              <Input
                placeholder="Search a trait…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-center gap-4 mb-2 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-slate-400"></div>
                  <span>Solid line: Positive correlation (ρ {'>'} 0)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 border-t-2 border-dashed border-slate-400"></div>
                  <span>Dashed line: Negative correlation (ρ {'<'} 0)</span>
                </div>
              </div>
              <svg
                ref={ggmSvgRef}
                className="w-full h-[360px] sm:h-[420px] lg:h-[600px] border rounded-lg bg-white"
              />
            </>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="Search a node…"
                value={colocSearchTerm}
                onChange={e => setColocSearchTerm(e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-[#6c408e]"></div>
                  <span className="text-sm">Gene</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-[#ece399]"></div>
                  <span className="text-sm">GIM Biomarkers</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-2 bg-[#FF4757]"></div>
                  <span className="text-sm">Colocalization (eQTL)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-2 border-2 border-[#FF6B9D] border-dashed"></div>
                  <span className="text-sm">Colocalization (sQTL)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-2 bg-[#2ED573]"></div>
                  <span className="text-sm">PPI</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-2 bg-[#3742FA]"></div>
                  <span className="text-sm">GGM</span>
                </div>
              </div>
              
              <div className="text-center text-sm text-gray-600 mb-2">
                Network: {colocNodes.length} nodes, {colocLinks.length} links
              </div>
              
              <svg
                ref={colocSvgRef}
                className="w-full h-[360px] sm:h-[420px] lg:h-[600px] border rounded-lg bg-white"
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5 lg:min-h-[600px]">
          {selectedNode && networkType === 'ggm' ? (
            <>
              <Card className="lg:flex-1">
                <CardHeader><CardTitle>{selectedNode.id}</CardTitle></CardHeader>
                <CardContent>
                  <p><strong>Group:</strong> {selectedNode.group}</p>
                  <p><strong>Index:</strong> {selectedNode.index}</p>
                </CardContent>
              </Card>
              <Card className="lg:flex-1">
                <CardHeader><CardTitle>Top 5 Partial Correlations</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Trait</TableHead>
                          <TableHead className="text-right">ρ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {top5.map(r => (
                          <TableRow key={r.id}>
                            <TableCell>{r.id}</TableCell>
                            <TableCell className="text-right">{r.value.toFixed(3)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : networkType === 'ggm' ? (
            <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-600 flex items-center justify-center lg:flex-1">
              Click a node to see details & top-5 correlations.
            </div>
          ) : selectedColocNode ? (
            <>
              <Card className="lg:flex-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: selectedColocNode.node_type === 'Gene' ? '#6c408e' : '#ece399' }}
                    />
                    {selectedColocNode.node}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p><strong>Type:</strong> {selectedColocNode.node_type === 'Gene' ? 'Protein-coding genes' : 'Traits in GIMs'}</p>
                      {selectedColocNode.node_type !== 'Gene' && (
                        <p><strong>Group:</strong> {selectedColocNode.Group}</p>
                      )}
                      {selectedColocNode.Description && (
                        <p><strong>Description:</strong> {selectedColocNode.Description}</p>
                      )}
                    </div>
                    <div>
                      {selectedColocNode.mean_degree && (
                        <p><strong>Degree:</strong> {selectedColocNode.mean_degree}</p>
                      )}
                      {selectedColocNode.mean_betweenness && (
                        <p><strong>Betweenness:</strong> {parseFloat(selectedColocNode.mean_betweenness).toFixed(2)}</p>
                      )}
                      {selectedColocNode.GENE && (
                        <p><strong>Gene:</strong> {selectedColocNode.GENE}</p>
                      )}
                    </div>
                  </div>
                  
                  {selectedColocNode.qtl_type && (
                    <p><strong>QTL Type:</strong> {formatQTLType(selectedColocNode.qtl_type)}</p>
                  )}
                  {selectedColocNode['PP.H4.abf'] && (
                    <p><strong>{formatPPValue('PP.H4.abf')}:</strong> {parseFloat(selectedColocNode['PP.H4.abf']).toFixed(6)}</p>
                  )}

                  {/* Show colocalization info for traits */}
                  {selectedColocNode.node_type === 'GIM Biomarkers' && getTraitColocalizationInfo(selectedColocNode) && (
                    <div className="mt-4">
                      <p className="font-semibold text-sm text-gray-700 mb-2">Colocalized signals:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {getTraitColocalizationInfo(selectedColocNode)?.map((coloc, index) => (
                          <div key={index} className="rounded bg-gray-50 p-2 text-xs">
                            <p><strong>{coloc.gene}</strong></p>
                            <p className="text-gray-600">{coloc.geneGroup}</p>
                            <p>PP H4: {coloc.pp4.toFixed(4)} | {formatQTLType(coloc.qtl_type)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Supplemental coloc hits for the selected node */}
                  {(() => {
                    const supplement = getSupplementForNode(selectedColocNode);
                    if (!supplement.length) return null;
                    return (
                      <div className="mt-4">
                        <p className="font-semibold text-sm text-gray-700 mb-2">
                          Supplemental colocalization hits ({supplement.length})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {supplement.slice(0, 8).map((row: any, idx: number) => (
                            <div key={`${row.gene}-${row.trait}-${idx}`} className="rounded border border-gray-200 p-2 bg-gray-50">
                              <p className="font-semibold text-indigo-700">{row.gene}</p>
                              <p className="text-gray-700">{row.trait}</p>
                              <p className="font-mono text-[11px] text-gray-600">Hit1: {row.hit1}</p>
                              <p className="font-mono text-[11px] text-gray-600">Hit2: {row.hit2}</p>
                              <p className="text-gray-700">PP4: {row.pp4 ?? row.PP_H4 ?? row.PP_H4_abf ?? row.PP?.H4 ?? ''}</p>
                              <p className="text-gray-600">Region: {row.region}</p>
                            </div>
                          ))}
                        </div>
                        {supplement.length > 8 && (
                          <p className="mt-2 text-[11px] text-gray-500">Showing first 8 matches.</p>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
              <Card className="lg:flex-1">
                <CardHeader>
                  <CardTitle>Connected Nodes ({colocConnectedNodes.length})</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col lg:h-full">
                  <div className="overflow-x-auto">
                    <div className="mt-2 max-h-64 sm:max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/4">Node</TableHead>
                            <TableHead className="w-1/4">Type</TableHead>
                            <TableHead className="w-1/2">Connected Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {colocPaginatedNodes.map((connection, index) => (
                            <TableRow key={index}>
                              <TableCell className="w-1/4">{connection.node.node}</TableCell>
                              <TableCell className="w-1/4">{connection.node.node_type === 'Gene' ? 'Protein-coding genes' : 'Traits in GIMs'}</TableCell>
                              <TableCell className="w-1/2">
                                <span 
                                  className="whitespace-nowrap rounded px-2 py-1 text-xs text-white"
                                  style={{ 
                                    backgroundColor: connection.data_source === 'coloc' 
                                      ? (connection.qtl_type?.toLowerCase() === 'sqtl' ? '#FF6B9D' : '#FF4757')
                                      : connection.data_source === 'PPI' ? '#2ED573' : '#3742FA' 
                                  }}
                                >
                                  {getConnectedTypeText(connection.data_source, connection.qtl_type)}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  {colocTotalPages > 1 && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <div className="text-sm text-gray-600">
                        Page {colocPage} of {colocTotalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setColocPage(Math.max(1, colocPage - 1))}
                          disabled={colocPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setColocPage(Math.min(colocTotalPages, colocPage + 1))}
                          disabled={colocPage === colocTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-600 flex items-center justify-center lg:flex-1">
              Colocalization network details will appear here when you click on nodes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneMetaboliteNetworkPage;
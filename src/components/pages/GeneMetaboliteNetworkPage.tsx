// src/components/pages/GeneMetaboliteNetworkPage.tsx
import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import toast from 'react-hot-toast';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';

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

const colorPalette = [
  '#d4de9c', '#94c58f', '#86c7b4', '#9cd2ed',
  '#a992c0', '#ea9994', '#f2c396', '#bb82b1'
];

const GeneMetaboliteNetworkPage: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [links, setLinks] = useState<LinkDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDatum|null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // draw network
  useEffect(() => {
    if (loading || error || !svgRef.current || nodes.length === 0) return;

    const svgEl = svgRef.current;
    const width = svgEl.clientWidth;
    const height = 600;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const gZoom = svg.append('g');
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .on('zoom', e => gZoom.attr('transform', e.transform)));

    const colorScale = d3.scaleOrdinal<string, string>()
      .domain(nodes.map(d => d.group))
      .range(colorPalette);

    // simulation
    const simulation = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<LinkDatum, NodeDatum>(links).distance(120).strength(1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width/2, height/2));

    // links
    const linkSel = gZoom.append('g')
      .attr('stroke', '#bbb')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', d => Math.sqrt(Math.abs(d.value)));

    // tooltip
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

    // draw nodes
    const nodeSel = gZoom.append('g')
      .attr('stroke', '#fff').attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(filtered)
      .enter().append('circle')
      .attr('r', 12)
      .attr('fill', d => colorScale(d.group))
      .call(d3.drag<SVGCircleElement, NodeDatum>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('mouseover', (e, d) => {
        tooltip
          .text(d.id)
          .style('left', (e.pageX + 8) + 'px')
          .style('top',  (e.pageY + 8) + 'px')
          .transition().duration(150).style('opacity',1);
      })
      .on('mouseout', () =>
        tooltip.transition().duration(150).style('opacity',0)
      )
      .on('click', (_, d) => setSelectedNode(d));

    // draw labels
    const labelSel = gZoom.append('g')
      .selectAll('text')
      .data(filtered)
      .enter().append('text')
      .text(d => d.id)
      .attr('font-size', 10)
      .attr('fill', '#333')
      .attr('dx', 14)
      .attr('dy', '0.31em');

    // tick updates
    simulation.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x!)
        .attr('y1', d => d.source.y!)
        .attr('x2', d => d.target.x!)
        .attr('y2', d => d.target.y!);
      nodeSel
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);
      labelSel
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
      svg.selectAll('*').remove();
    };
  }, [loading, error, nodes, links, searchTerm]);

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

  if (loading) return (
    <div className="p-6 flex justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-b-transparent rounded-full"/>
    </div>
  );
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-2">GGM Partial-Correlation Network</h1>
        <p className="text-gray-700">
          This graph displays <strong>partial correlations</strong> among the NMR metabolic traits lying in the identified GIMs.
          Drag nodes to explore, and click to inspect its top-5 connections.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <Input
            placeholder="Search a trait…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <svg
            ref={svgRef}
            className="w-full h-[600px] border rounded-lg bg-white"
          />
        </div>
        <div className="space-y-4">
          {selectedNode ? (
            <>
              <Card>
                <CardHeader><CardTitle>{selectedNode.id}</CardTitle></CardHeader>
                <CardContent>
                  <p><strong>Group:</strong> {selectedNode.group}</p>
                  <p><strong>Index:</strong> {selectedNode.index}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Top 5 Partial Correlations</CardTitle></CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-600">
              Click a node to see details & top-5 correlations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneMetaboliteNetworkPage;
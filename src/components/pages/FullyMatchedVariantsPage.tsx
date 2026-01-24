import React, { useState, useEffect, useMemo } from 'react'
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Table as TableIcon } from 'lucide-react'
import { Input } from '../ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '../ui/select'
import { Badge } from '../ui/badge'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '../ui/table'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell
} from 'recharts'

// RegulomeDB possible ranks (in true order)
const REGDB_CATEGORIES = [
  '1a','1b','1c','1d','1e','1f',
  '2a','2b','2c',
  '3a','3b',
  '4','5','6','7'
]

// Color map for functional roles
const ROLE_COLOR_MAP: Record<string,string> = {
  intronic:   'bg-green-100 text-green-800',
  exonic:     'bg-blue-100 text-blue-800',
  upstream:   'bg-purple-100 text-purple-800',
  downstream: 'bg-orange-100 text-orange-800',
  UTR3:       'bg-teal-100 text-teal-800',
  UTR5:       'bg-teal-200 text-teal-900'
}

// Palette for matched studies badges
const STUDY_COLORS = [
  'bg-red-100 text-red-800',
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
  'bg-orange-100 text-orange-800'
]

interface VariantRecord {
  reportedVariant: string
  chromosome: number | null
  position: number | null
  refAllele: string
  altAllele: string
  nearestGene: string
  functionalRole: string
  caddScore: number | null
  regulomeDB: string
  matchedStudies: string
  studyDetail1: string
  studyDetail2: string
  studyDetail3: string
  studyDetail4: string
}

interface VariantDataset {
  title: string
  description: string
  note?: string
  data: VariantRecord[]
}

type SortField = keyof VariantRecord
type SortDirection = 'asc' | 'desc'

export default function FullyMatchedVariantsPage() {
  const [data, setData] = useState<VariantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGene, setFilterGene] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStudy, setFilterStudy] = useState('all')
  const [sortField, setSortField] = useState<SortField>('reportedVariant')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'table'|'summary'>('table')
  const [selected, setSelected] = useState<VariantRecord|null>(null)
  const perPage = 20

  // Load JSON dataset
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${import.meta.env.BASE_URL}data/matched_variants_2026.json`)
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        const json: VariantDataset = await response.json()
        setData(Array.isArray(json.data) ? json.data : [])
      } catch (error) {
        console.error(error)
        toast.error('Failed to load matched variants data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []);

  // Derive filter options
  const genes = useMemo(
    () => Array.from(new Set(data.map(d => d.nearestGene).filter(Boolean))).sort(),
    [data]
  );
  const roles = useMemo(
    () => Array.from(new Set(data.map(d => d.functionalRole).filter(Boolean))).sort(),
    [data]
  );
  const studies = useMemo(() => {
    const bucket = new Set<string>();
    data.forEach(item => {
      item.matchedStudies
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(s => bucket.add(s));
    });
    return Array.from(bucket).sort();
  }, [data]);

  // Filter and sort
  const filtered = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return data
      .filter(record => {
        const matchText =
          !lowerSearch ||
          [
            record.reportedVariant,
            record.nearestGene,
            record.functionalRole,
            record.matchedStudies
          ]
            .filter(Boolean)
            .some(value => value.toLowerCase().includes(lowerSearch));

        const matchGene = filterGene === 'all' || record.nearestGene === filterGene;
        const matchRole = filterRole === 'all' || record.functionalRole === filterRole;
        const studyTokens = record.matchedStudies
          .split(';')
          .map(token => token.trim())
          .filter(Boolean);
        const matchStudy = filterStudy === 'all' || studyTokens.includes(filterStudy);

        return matchText && matchGene && matchRole && matchStudy;
      })
      .sort((a, b) => {
        const valueA = a[sortField];
        const valueB = b[sortField];
        if (typeof valueA === 'number' && typeof valueB === 'number') {
          return sortDir === 'asc' ? valueA - valueB : valueB - valueA;
        }
        return sortDir === 'asc'
          ? String(valueA ?? '').localeCompare(String(valueB ?? ''))
          : String(valueB ?? '').localeCompare(String(valueA ?? ''));
      });
  }, [data, search, filterGene, filterRole, filterStudy, sortField, sortDir]);

  // Pagination
  const paged = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page]);
  const totalPages = Math.ceil(filtered.length / perPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const sortIcon = (field: SortField) =>
    sortField !== field
      ? <ArrowUpDown className="w-4 h-4 text-gray-400" />
      : sortDir === 'asc'
        ? <ArrowUp className="w-4 h-4 text-blue-600" />
        : <ArrowDown className="w-4 h-4 text-blue-600" />;

  // Summary stats
  const stats = useMemo(() => {
    const total = data.length;
    const uniqueRpt = new Set(data.map(d => d.reportedVariant)).size;
    const uniqueGenes = new Set(data.map(d => d.nearestGene)).size;
    const caddValues = data
      .map(d => d.caddScore)
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
    const avgCADD = caddValues.length
      ? caddValues.reduce((sum, value) => sum + value, 0) / caddValues.length
      : 0;
    const roleCounts = roles.map(role => ({
      role,
      count: data.filter(d => d.functionalRole === role).length
    }));
    return { total, uniqueRpt, uniqueGenes, avgCADD, roleCounts };
  }, [data, roles]);

  const uniqueStudyCount = studies.length;

  const infoBlurb = useMemo(() => {
    if (!data.length) return [];
    return [
      `This folloing table cross-references ${stats.total.toLocaleString()} lead variants from mGWAS that were reported as associated with published GWAS for gastric cancer or lesion progression.`,
      'Columns summarise predicted functional impact (CADD, RegulomeDB) alongside information about the matched source publications.',
      'Use the filters to focus on particular genes, functional roles, or studies and spot variants that recur across cohorts or carry stronger regulatory signals.'
    ];
  }, [data.length, stats.total, uniqueStudyCount]);

  if (loading) return <div className="p-6 text-center">Loading…</div>;

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
        <div className="flex justify-between items-start flex-col lg:flex-row gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <TableIcon className="w-8 h-8 text-green-600" />
            <span>Lead Variants in the mGWAS Reported as Associated with Gastric Cancer & Gastric Lesion Progression</span>
          </h1>
          <p className="text-gray-600">Showing {filtered.length} of {data.length} variants.</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search…"
                className="pl-10"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={filterGene} onValueChange={v => { setFilterGene(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All Genes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Nearest Genes</SelectItem>
                {genes.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={v => { setFilterRole(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All Functions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Functional role of variants</SelectItem>
                {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStudy} onValueChange={v => { setFilterStudy(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="All Studies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Matched Studies</SelectItem>
                {studies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      {infoBlurb.length > 0 && (
        <div className="text-sm text-gray-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
          {infoBlurb.map((paragraph, idx) => (
            <p key={idx} className="leading-6">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as 'table' | 'summary')}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Table View */}
        <TabsContent value="table">
          <div className="overflow-auto bg-white rounded shadow">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  {([
                    ['reportedVariant','Reported variant'],
                    ['chromosome','Chr'],
                    ['position','Pos'],
                    ['refAllele','Ref'],
                    ['altAllele','Alt'],
                    ['nearestGene','Gene'],
                    ['functionalRole','Function'],
                    ['caddScore','CADD'],
                    ['regulomeDB','RegDB'],
                    ['matchedStudies','Matched Studies']
                  ] as [SortField,string][]).map(([key,label]) => (
                    <TableHead
                      key={key}
                      onClick={() => handleSort(key)}
                      className="cursor-pointer px-3 py-2 text-left"
                    >
                      <div className="flex items-center space-x-1">
                        <span className="truncate">{label}</span>
                        {sortField === key && sortIcon(key)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((d, i) => (
                  <TableRow
                    key={i}
                    onClick={() => setSelected(d)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <TableCell className="px-3 py-1">{d.reportedVariant}</TableCell>
                    <TableCell className="px-3 py-1">{d.chromosome}</TableCell>
                    <TableCell className="px-3 py-1">{d.position}</TableCell>
                    <TableCell className="px-3 py-1">{d.refAllele}</TableCell>
                    <TableCell className="px-3 py-1">{d.altAllele}</TableCell>
                    <TableCell className="px-3 py-1">{d.nearestGene}</TableCell>
                    <TableCell className="px-3 py-1">
                      <Badge className={ROLE_COLOR_MAP[d.functionalRole] || 'bg-gray-100 text-gray-800'}>
                        {d.functionalRole}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-1">
                      {typeof d.caddScore === 'number' && !Number.isNaN(d.caddScore)
                        ? d.caddScore.toFixed(2)
                        : '—'}
                    </TableCell>
                    <TableCell className="px-3 py-1">{d.regulomeDB}</TableCell>
                    <TableCell className="px-3 py-1 whitespace-normal">
                      {d.matchedStudies
                        .split(';')
                        .map(study => study.trim())
                        .filter(Boolean)
                        .map((study, idx) => {
                          const paletteIndex = studies.indexOf(study);
                          const colorClass =
                            STUDY_COLORS[
                              (paletteIndex >= 0 ? paletteIndex : idx) % STUDY_COLORS.length
                            ];
                          return (
                            <Badge key={`${study}-${idx}`} className={`${colorClass} mr-2 mb-1`}>
                              {study}
                            </Badge>
                          );
                        })}
                      {!d.matchedStudies.trim() && <span className="text-xs text-gray-500">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center py-4">
              <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
              <div className="flex items-center space-x-2">
                <button 
                  disabled={page===1} 
                  onClick={() => setPage(p=>p-1)} 
                  className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Prev
                </button>
                
                {/* Page Numbers */}
                <div className="flex items-center space-x-1">
                  {/* First page */}
                  {page > 3 && (
                    <>
                      <button
                        onClick={() => setPage(1)}
                        className="px-2 py-1 border rounded hover:bg-gray-50 text-sm"
                      >
                        1
                      </button>
                      {page > 4 && <span className="px-1 text-gray-400">...</span>}
                    </>
                  )}
                  
                  {/* Current page and neighbors */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-2 py-1 border rounded text-sm ${
                          pageNum === page 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {/* Last page */}
                  {page < totalPages - 2 && (
                    <>
                      {page < totalPages - 3 && <span className="px-1 text-gray-400">...</span>}
                      <button
                        onClick={() => setPage(totalPages)}
                        className="px-2 py-1 border rounded hover:bg-gray-50 text-sm"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                
                <button 
                  disabled={page===totalPages} 
                  onClick={() => setPage(p=>p+1)} 
                  className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Summary View */}
        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card><CardHeader><CardTitle>Total Variants</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.total}</CardContent></Card>
            <Card><CardHeader><CardTitle>Unique Reported</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.uniqueRpt}</CardContent></Card>
            <Card><CardHeader><CardTitle>Unique Genes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.uniqueGenes}</CardContent></Card>
            <Card><CardHeader><CardTitle>Avg CADD</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.avgCADD.toFixed(2)}</CardContent></Card>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">By Functional Role</h3>
            <div style={{ height: 300 }}> 
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.roleCounts} margin={{ top:20,right:30,left:20,bottom:50 }}>
                  <XAxis dataKey="role" angle={-45} textAnchor="end" interval={0}/>
                  <YAxis/>
                  <RechartsTooltip/>
                  <Bar dataKey="count" barSize={20}>
                    {stats.roleCounts.map((_,i)=><Cell key={i} fill={i%2? '#6366F1':'#10B981'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto space-y-6">
            <div className="flex justify-between">
              <h3 className="text-2xl font-semibold">Variant Details</h3>
              <button onClick={()=>setSelected(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div><strong>Reported variant:</strong> {selected.reportedVariant}</div>
                <div><strong>Chr:</strong> {selected.chromosome}</div>
                <div><strong>Pos:</strong> {selected.position}</div>
                <div><strong>Ref allele:</strong> {selected.refAllele}</div>
                <div><strong>Alt allele:</strong> {selected.altAllele}</div>
                <div><strong>Gene:</strong> {selected.nearestGene}</div>
                <div><strong>Function:</strong> <Badge className={`ml-2 ${ROLE_COLOR_MAP[selected.functionalRole]|| 'bg-gray-100 text-gray-800'}`}>{selected.functionalRole}</Badge></div>
                <div>
                  <strong>Matched Studies:</strong>{' '}
                  {selected.matchedStudies
                    .split(';')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map((s, i) => (
                      <Badge key={i} className="ml-2 mr-1 bg-gray-200 text-gray-800">
                        {s}
                      </Badge>
                    ))}
                  {!selected.matchedStudies.trim() && <span className="ml-2 text-gray-500">—</span>}
                </div>
              </div>
              <div className="space-y-6">
                {typeof selected.caddScore === 'number' && !Number.isNaN(selected.caddScore) && (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[{ name: 'CADD', value: selected.caddScore }]}
                        layout="vertical"
                        margin={{ left: 40, right: 20, top: 10, bottom: 10 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                        <RechartsTooltip formatter={value => (value as number).toFixed(2)} />
                        <Bar dataKey="value" fill="#6366F1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium mb-2">RegulomeDB Score</h4>
                  <div className="grid grid-cols-5 gap-1">
                    {REGDB_CATEGORIES.map(cat=>(<div key={cat} className={`w-10 h-10 flex items-center justify-center text-xs font-semibold border rounded ${selected.regulomeDB===cat?'bg-orange-600 text-white':'bg-gray-100 text-gray-500 border-gray-200'}`}>{cat}</div>))}
                  </div>
                </div>
                {[selected.studyDetail1, selected.studyDetail2, selected.studyDetail3, selected.studyDetail4]
                  .filter(detail => detail && detail.trim().length > 0)
                  .length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Published study excerpts</h4>
                    <div className="space-y-3 text-sm text-gray-700">
                      {[selected.studyDetail1, selected.studyDetail2, selected.studyDetail3, selected.studyDetail4]
                        .filter(detail => detail && detail.trim().length > 0)
                        .map((detail, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50 border border-slate-200 rounded-md p-3 whitespace-pre-wrap"
                          >
                            {detail}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

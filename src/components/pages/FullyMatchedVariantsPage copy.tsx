// src/components/pages/FullyMatchedVariantsPage.tsx
import React, { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import {
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Table as TableIcon
} from 'lucide-react'
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
  intronic:       'bg-green-100 text-green-800',
  exonic:         'bg-blue-100 text-blue-800',
  upstream:       'bg-purple-100 text-purple-800',
  downstream:     'bg-orange-100 text-orange-800',
  UTR3:           'bg-teal-100 text-teal-800',
  UTR5:           'bg-teal-200 text-teal-900'
}

interface VariantRecord {
  reportedVariant: string
  chromosome: number
  position: number
  refAllele: string
  altAllele: string
  nearestGene: string
  functionalRole: string
  caddScore: number
  regulomeDB: string
  matchedStudies: string
}

type SortField = keyof VariantRecord
type SortDirection = 'asc' | 'desc'

export default function FullyMatchedVariantsPage() {
  const [data, setData] = useState<VariantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGene, setFilterGene] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [sortField, setSortField] = useState<SortField>('reportedVariant')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<'table'|'summary'>('table')
  const [selected, setSelected] = useState<VariantRecord|null>(null)
  const perPage = 20

  // 1) load CSV
  useEffect(() => {
    Papa.parse<Partial<VariantRecord>>(
      `${import.meta.env.BASE_URL}data/variants.overlap.GC_6938.FUMA.df.fully_matched.csv`,
      {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          if (res.errors.length) {
            console.error(res.errors)
            toast.error('Failed to parse variants CSV')
          } else {
            const rows: VariantRecord[] = res.data.map(row => ({
              reportedVariant:  String(row['Reported variant']  || ''),
              chromosome:       Number(row['chromosome']        || 0),
              position:         Number(row['position']          || 0),
              refAllele:        String(row['Ref allele']        || ''),
              altAllele:        String(row['Alt allel']         || ''),
              nearestGene:      String(row['Nearest gene']      || ''),
              functionalRole:   String(row['Functional role']   || ''),
              caddScore:        Number(row['CADD score']        || 0),
              regulomeDB:       String(row['Regulome DB score'] || ''),
              matchedStudies:   String(row['MatchedStudies']    || '')
            }))
            setData(rows)
          }
          setLoading(false)
        }
      }
    )
  }, [])

  const genes = useMemo(() =>
    Array.from(new Set(data.map(d => d.nearestGene))).sort()
  , [data])

  const roles = useMemo(() =>
    Array.from(new Set(data.map(d => d.functionalRole))).sort()
  , [data])

  // 2) filter & sort
  const filtered = useMemo(() => {
    let arr = data.filter(d => {
      const s = search.toLowerCase()
      const matchText = [
        d.reportedVariant,
        d.nearestGene,
        d.functionalRole
      ].some(f => f.toLowerCase().includes(s))
      const matchGene = filterGene === 'all' || d.nearestGene === filterGene
      const matchRole = filterRole === 'all' || d.functionalRole === filterRole
      return matchText && matchGene && matchRole
    })
    arr.sort((a,b) => {
      let va = a[sortField], vb = b[sortField], c = 0
      if (typeof va === 'number' && typeof vb === 'number') c = va - vb
      else c = String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? c : -c
    })
    return arr
  }, [data, search, filterGene, filterRole, sortField, sortDir])

  const paged = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page]
  )
  const totalPages = Math.ceil(filtered.length / perPage)

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(f); setSortDir('asc') }
    setPage(1)
  }
  const sortIcon = (f: SortField) =>
    sortField !== f
      ? <ArrowUpDown className="w-4 h-4 text-gray-400"/>
      : sortDir === 'asc'
        ? <ArrowUp className="w-4 h-4 text-blue-600"/>
        : <ArrowDown className="w-4 h-4 text-blue-600"/>

  // 3) summary stats
  const stats = useMemo(() => {
    const total = data.length
    const uniqueRpt = new Set(data.map(d => d.reportedVariant)).size
    const uniqueGenes = new Set(data.map(d => d.nearestGene)).size
    const avgCADD = total ? data.reduce((s,d)=>s+d.caddScore,0)/total : 0
    const roleCounts = roles.map(r => ({
      role: r,
      count: data.filter(d => d.functionalRole === r).length
    }))
    return { total, uniqueRpt, uniqueGenes, avgCADD, roleCounts }
  }, [data, roles])

  if (loading) return <div className="p-6 text-center">Loading…</div>

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <TableIcon className="w-8 h-8 text-green-600"/>
            <span>Tag variants reported previously</span>
          </h1>
          <p className="text-gray-600">
            Showing {filtered.length} of {data.length} variants.
          </p>
        </div>
        <div className="space-x-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded flex items-center">
            <Download className="w-4 h-4 mr-1"/> CSV
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded flex items-center">
            <Download className="w-4 h-4 mr-1"/> JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600"/>
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <Input
                placeholder="Search…"
                className="pl-10"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={filterGene} onValueChange={v => { setFilterGene(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="All Genes"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Nearest Genes</SelectItem>
                {genes.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={v => { setFilterRole(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="All Functions"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Functional consequence of variants</SelectItem>
                {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      <p className="text-sm text-gray-500 italic">
        <strong>Note:</strong><br/>
          1. This panel displays the independent tag variants at GIM genomic loci that have been previously reported to associate with gastric cancer or with the progression of gastric lesions. <br/> 
          2. Functional consequence of variants on the genes were obtained from ANNOVAR.<br/>
          3. The column of Matched Studies lists each study (with its p-threshold).<br/>
          4. CADD and RegulomeDB scores were annotated by FUMA
      </p>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* Table */}
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
                  ] as [SortField,string][]).map(([key,label])=>(
                    <TableHead
                      key={key}
                      onClick={()=>handleSort(key)}
                      className="cursor-pointer px-3 py-2 text-left"
                    >
                      <div className="flex items-center space-x-1">
                        <span className="truncate">{label}</span>
                        {sortField===key && sortIcon(key)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((d,i)=>(
                  <TableRow
                    key={i}
                    onClick={()=>setSelected(d)}
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
                    <TableCell className="px-3 py-1">{d.caddScore.toFixed(2)}</TableCell>
                    <TableCell className="px-3 py-1">{d.regulomeDB}</TableCell>
                    <TableCell className="px-3 py-1 whitespace-normal">{d.matchedStudies}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages>1 && (
            <div className="flex justify-between items-center py-4">
              <span className="text-sm text-gray-600">
                Page {page} / {totalPages}
              </span>
              <div className="space-x-2">
                <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-2 py-1 border rounded">Prev</button>
                <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded">Next</button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Summary */}
        <TabsContent value="summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader><CardTitle>Total Variants</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{stats.total}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Unique Reported</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{stats.uniqueRpt}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Unique Genes</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{stats.uniqueGenes}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Avg CADD</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{stats.avgCADD.toFixed(2)}</CardContent>
            </Card>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">By Functional Role</h3>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.roleCounts}
                  margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                >
                  <XAxis dataKey="role" angle={-45} textAnchor="end" interval={0}/>
                  <YAxis/>
                  <RechartsTooltip/>
                  <Bar dataKey="count" fill="#3b82f6">
                    {stats.roleCounts.map((_,i)=>(
                      <Cell key={i} fill={i%2? '#6366F1':'#10B981'}/>
                    ))}
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
                <div>
                  <strong>Function:</strong>
                  <Badge className={`ml-2 ${ROLE_COLOR_MAP[selected.functionalRole] || 'bg-gray-100 text-gray-800'}`}>
                    {selected.functionalRole}
                  </Badge>
                </div>
                <div><strong>Matched Studies:</strong> {selected.matchedStudies}</div>
              </div>
              <div className="space-y-6">
                {/* CADD */}
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[{ name: 'CADD', value: selected.caddScore }]}
                      layout="vertical"
                      margin={{ left: 40, right: 20, top: 10, bottom: 10 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                      <RechartsTooltip formatter={v => (v as number).toFixed(2)} />
                      <Bar dataKey="value" fill="#6366F1" barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* RegulomeDB Score Heatmap */}
                <div>
                  <h4 className="text-sm font-medium mb-2">RegulomeDB Score</h4>
                  <div className="grid grid-cols-5 gap-1">
                    {REGDB_CATEGORIES.map(cat => (
                      <div
                        key={cat}
                        className={`
                          w-10 h-10 flex items-center justify-center text-xs font-semibold border rounded
                          ${selected.regulomeDB === cat
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-gray-100 text-gray-500 border-gray-200'}
                        `}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
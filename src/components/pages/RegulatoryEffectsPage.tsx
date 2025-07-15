// src/components/pages/RegulatoryEffectsPageEnhanced.tsx
import React, { useState, useEffect, useMemo } from 'react'
import {
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Globe
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

interface RegulatoryEffectData {
  biomarker: string
  variant: string
  gene_symbol: string
  harmony_grade: string
  cytoband?: string
  chromosome?: number
  ref_allele?: string
  alt_allele?: string
  region_start?: number
  region_end?: number
  effect_europeans?: number | null
  effect_finns?: number | null
  effect_nonfinnish_europeans?: number | null
  effect_south_asians?: number | null
  effect_east_asians?: number | null
  effect_africans?: number | null
}

interface RegulatoryEffectDataset {
  title: string
  description: string
  data: RegulatoryEffectData[]
}

type SortField = keyof RegulatoryEffectData
type SortDirection = 'asc' | 'desc' | null

const ancestryGroups = [
  { key: 'effect_europeans', label: 'Europeans' },
  { key: 'effect_finns', label: 'Finns' },
  { key: 'effect_nonfinnish_europeans', label: 'Non-Finnish Europeans' },
  { key: 'effect_south_asians', label: 'South Asians' },
  { key: 'effect_east_asians', label: 'East Asians' },
  { key: 'effect_africans', label: 'Africans' }
] as const

const ANCESTRY_COLORS: Record<string,string> = {
  effect_europeans:           '#3b82f6',
  effect_finns:               '#10b981',
  effect_nonfinnish_europeans:'#f59e0b',
  effect_south_asians:        '#ef4444',
  effect_east_asians:         '#8b5cf6',
  effect_africans:            '#ec4899'
}

export default function RegulatoryEffectsPageEnhanced() {
  const [data, setData] = useState<RegulatoryEffectDataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBiomarker, setSelectedBiomarker] = useState('all')
  const [selectedGene, setSelectedGene] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [selectedAncestry, setSelectedAncestry] = useState('all')
  const [sortField, setSortField] = useState<SortField>('harmony_grade')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedEffect, setSelectedEffect] = useState<RegulatoryEffectData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'table'|'stats'>('table')
  const itemsPerPage = 25

  // ── Load & parse JSONs ───────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [basicRes, ancRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/regulatory_effects.json`),
          fetch(`${import.meta.env.BASE_URL}data/ancestry_reg_effects.json`)
        ])
        if (!basicRes.ok || !ancRes.ok) throw new Error('Fetch failed')
        let [basicText, ancText] = await Promise.all([ basicRes.text(), ancRes.text() ])
        basicText = basicText.replace(/\bNaN\b/g,'null')
        ancText   = ancText.replace(/\bNaN\b/g,'null')
        const basic = JSON.parse(basicText)
        const ancRaw = JSON.parse(ancText)
        const KEY = 'Supplementary table 10. Multi-ancestry gene loci regulatory effects on traits in the GIMs of GC and gastric lesion progression'
        const rows: any[] = ancRaw.sheets?.Sheet1?.data ?? []

        const processed: RegulatoryEffectData[] = rows.map(item => ({
          biomarker:   item[KEY],
          variant:     item['Unnamed: 1'],
          harmony_grade: String(item['Unnamed: 3']),
          cytoband:      item['Unnamed: 4'],
          gene_symbol:   item['Unnamed: 5'],
          chromosome:    item['Unnamed: 7'],
          region_start:  item['Unnamed: 8'],
          region_end:    item['Unnamed: 9'],
          ref_allele:    item['Unnamed: 10'],
          alt_allele:    item['Unnamed: 11'],
          effect_europeans:            item['Unnamed: 16'],
          effect_finns:                item['Unnamed: 17'],
          effect_nonfinnish_europeans: item['Unnamed: 18'],
          effect_south_asians:         item['Unnamed: 19'],
          effect_east_asians:          item['Unnamed: 20'],
          effect_africans:             item['Unnamed: 21']
        })).filter(r => r.biomarker && r.variant)

        setData({
          title: basic.title,
          description: basic.description,
          data: processed
        })
      } catch (err) {
        console.error(err)
        toast.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Unique filter lists ──────────────────────────────────────
  const uniqueBiomarkers = useMemo(() =>
    data ? Array.from(new Set(data.data.map(d=>d.biomarker))).sort() : [], [data]
  )
  const uniqueGenes = useMemo(() =>
    data ? Array.from(new Set(data.data.map(d=>d.gene_symbol))).sort() : [], [data]
  )
  const uniqueGrades = useMemo(() =>
    data ? Array.from(new Set(data.data.map(d=>d.harmony_grade))).sort() : [], [data]
  )

  // ── Filter & Sort ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return []
    let arr = data.data.filter(d => {
      const s = searchTerm.toLowerCase()
      const matchSearch = [d.biomarker, d.variant, d.gene_symbol, d.cytoband]
        .some(v => v?.toLowerCase().includes(s))
      const matchBio   = selectedBiomarker === 'all' || d.biomarker === selectedBiomarker
      const matchGene  = selectedGene      === 'all' || d.gene_symbol === selectedGene
      const matchGrade = selectedGrade     === 'all' || d.harmony_grade === selectedGrade
      const matchAnc   = selectedAncestry  === 'all'
        || d[`effect_${selectedAncestry}` as keyof RegulatoryEffectData] != null
      return matchSearch && matchBio && matchGene && matchGrade && matchAnc
    })
    if (sortField) {
      arr.sort((a,b) => {
        let va=a[sortField] as any, vb=b[sortField] as any, c=0
        if (sortField==='harmony_grade')       c = Number(va)-Number(vb)
        else if ((sortField as string).startsWith('effect_'))
                                              c = (Number(va)||0)-(Number(vb)||0)
        else                                  c = String(va).localeCompare(String(vb))
        return sortDirection==='asc'? c : -c
      })
    }
    return arr
  }, [
    data, searchTerm,
    selectedBiomarker, selectedGene, selectedGrade, selectedAncestry,
    sortField, sortDirection
  ])

  const paged = useMemo(() =>
    filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage)
  , [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length/itemsPerPage)

  const handleSort = (f: SortField) => {
    if (sortField===f) setSortDirection(d=> d==='asc'?'desc': d==='desc'?null:'asc')
    else { setSortField(f); setSortDirection('asc') }
    setCurrentPage(1)
  }
  const getSortIcon = (f: SortField) => {
    if (sortField!==f) return <ArrowUpDown className="w-4 h-4 text-gray-400"/>
    return sortDirection==='asc'
      ? <ArrowUp className="w-4 h-4 text-blue-600"/>
      : <ArrowDown className="w-4 h-4 text-blue-600"/>
  }

  // ── Color helpers ──────────────────────────────────────────
  const gradeColor = (g: string) => {
    const n = Number(g)
    if (n>=5) return 'bg-red-600 text-white'
    if (n>=4) return 'bg-blue-600 text-white'
    if (n>=3) return 'bg-yellow-500 text-white'
    if (n>=2) return 'bg-orange-500 text-white'
    return 'bg-gray-300 text-gray-800'
  }
  const ancestryBadgeColor = (v?: number|null) => {
    if (v==null) return 'bg-gray-100 text-gray-500'
    if (v>0.1)    return 'bg-green-600 text-white'
    if (v>0)      return 'bg-blue-200 text-red-800'
    if (v<-0.1)   return 'bg-red-600 text-white'
    if (v<0)      return 'bg-red-200 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  // ── Ancestry stats for the Stats tab ───────────────────────
  const ancestryStats = useMemo(() => {
    const S: Record<string, any> = {}
    ancestryGroups.forEach(a => {
      const arr = filtered
        .map(d => d[a.key] as number)
        .filter(x => x!=null)
      S[a.key] = {
        count: arr.length,
        mean:  arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0,
        pos:   arr.filter(x=>x>0).length,
        neg:   arr.filter(x=>x<0).length
      }
    })
    return S
  }, [filtered])

  if (loading) return <div className="p-6 text-center">Loading…</div>
  if (!data)  return <div className="p-6 text-red-600">No data</div>

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* ── Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Globe className="w-8 h-8 text-orange-600"/>
            <span>Multi-ancestry Regulatory Effects</span>
          </h1>
          <p className="text-gray-600">{data.description}</p>
        </div>
        <div className="space-x-2">
          <button className="bg-orange-600 text-white px-4 py-2 rounded flex items-center">
            <Download className="w-4 h-4 mr-1"/> CSV
          </button>
          <button className="bg-orange-600 text-white px-4 py-2 rounded flex items-center">
            <Download className="w-4 h-4 mr-1"/> JSON
          </button>
        </div>
      </div>

      {/* ── Filters */}
      <Card>
        <CardHeader className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-600"/>  
          <CardTitle>Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <Input
                placeholder="Search…"
                value={searchTerm}
                onChange={e=>{ setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-10"
              />
            </div>
            <Select value={selectedBiomarker} onValueChange={v=>{setSelectedBiomarker(v); setCurrentPage(1)}}>
              <SelectTrigger><SelectValue placeholder="All Traits"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Traits</SelectItem>
                {uniqueBiomarkers.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedGene} onValueChange={v=>{setSelectedGene(v); setCurrentPage(1)}}>
              <SelectTrigger><SelectValue placeholder="All Outcomes"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                {uniqueGenes.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedGrade} onValueChange={v=>{setSelectedGrade(v); setCurrentPage(1)}}>
              <SelectTrigger><SelectValue placeholder="All Grades"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {uniqueGrades.map(g => (
                  <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAncestry} onValueChange={v=>{setSelectedAncestry(v); setCurrentPage(1)}}>
              <SelectTrigger><SelectValue placeholder="All Ancestries"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ancestries</SelectItem>
                {ancestryGroups.map(a => (
                  <SelectItem key={a.key} value={a.key.replace('effect_','')}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Consistent Grade Notice */}
      <p className="text-sm italic text-gray-500 mb-4">
        <strong>Note:</strong><br/>
        1. Consistent Grade is calculated as the difference between the highest and lowest counts of ancestries showing a consistent effect among those available.<br/>
        2. Information regarding the Documented regions for tag variants are extracted from Karjalainen et al [Nature. 2024 Apr;628(8006):130-138.]
      </p>


      {/* ── Tabs */}
      <Tabs value={activeTab} onValueChange={v=>setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="table">Data Table</TabsTrigger>
          <TabsTrigger value="stats">Ancestry Statistics</TabsTrigger>
        </TabsList>

        {/* ── Ancestry Statistics */}
        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ancestryGroups.map(a => {
              const st = ancestryStats[a.key]
              return (
                <Card key={a.key}>
                  <CardHeader className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                    <CardTitle>{a.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Count</span><span>{st.count}</span></div>
                      <div className="flex justify-between"><span>Mean</span><span>{st.mean.toFixed(3)}</span></div>
                      <div className="flex justify-between"><span>Positive</span><span>{st.pos}</span></div>
                      <div className="flex justify-between"><span>Negative</span><span>{st.neg}</span></div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Data Table */}
        <TabsContent value="table">
          <div className="overflow-auto bg-white rounded-lg shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead onClick={()=>handleSort('biomarker')} className="cursor-pointer px-4 py-2">
                    Metabolic Trait {getSortIcon('biomarker')}
                  </TableHead>
                  <TableHead onClick={()=>handleSort('variant')} className="cursor-pointer px-4 py-2">
                    Tag variant {getSortIcon('variant')}
                  </TableHead>
                  <TableHead onClick={()=>handleSort('gene_symbol')} className="cursor-pointer px-4 py-2">
                    Outcome {getSortIcon('gene_symbol')}
                  </TableHead>
                  <TableHead onClick={()=>handleSort('harmony_grade')} className="cursor-pointer px-4 py-2">
                    Consistent Grade {getSortIcon('harmony_grade')}
                  </TableHead>
                  {ancestryGroups.map(a => (
                    <TableHead
                      key={a.key}
                      onClick={()=>handleSort(a.key as SortField)}
                      className="cursor-pointer text-center px-4 py-2"
                    >
                      {a.label} {getSortIcon(a.key as SortField)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r,i) => (
                  <TableRow
                    key={`${r.variant}-${i}`}
                    onClick={()=>setSelectedEffect(r)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <TableCell className="px-4 py-2">{r.biomarker}</TableCell>
                    <TableCell className="px-4 py-2 font-mono">{r.variant}</TableCell>
                    <TableCell className="px-4 py-2">{r.gene_symbol}</TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge className={`${gradeColor(r.harmony_grade)} px-2`}>
                        {r.harmony_grade}
                      </Badge>
                    </TableCell>
                    {ancestryGroups.map(a => (
                      <TableCell key={a.key} className="px-4 py-2 text-center">
                        <Badge className={`${ancestryBadgeColor(r[a.key] as any)} px-2`}>
                          {(r[a.key] as any)?.toFixed(3) ?? 'N/A'}
                        </Badge>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages>1 && (
            <div className="flex items-center justify-between py-4">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <div className="space-x-2">
                <button
                  disabled={currentPage===1}
                  onClick={()=>setCurrentPage(p=>Math.max(p-1,1))}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >Prev</button>
                <button
                  disabled={currentPage===totalPages}
                  onClick={()=>setCurrentPage(p=>Math.min(p+1,totalPages))}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >Next</button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Detail Modal */}
      {selectedEffect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between mb-4">
              <h3 className="text-2xl font-semibold">Regulatory Effect Details</h3>
              <button onClick={()=>setSelectedEffect(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2 text-sm">
                <div><strong>Metabolic Trait:</strong> {selectedEffect.biomarker}</div>
                <div><strong>Tag variant:</strong> {selectedEffect.variant}</div>
                <div><strong>Outcome:</strong> {selectedEffect.gene_symbol}</div>
                <div><strong>Cytoband:</strong> {selectedEffect.cytoband}</div>
                <div><strong>Chromosome:</strong> {selectedEffect.chromosome}</div>
                <div><strong>Reference allele:</strong> {selectedEffect.ref_allele}</div>
                <div><strong>Alternate allele:</strong> {selectedEffect.alt_allele}</div>
                <div>
                  <strong>Documented region:</strong>
                  {selectedEffect.region_start}–{selectedEffect.region_end}
                </div>
                <div><strong>Consistent Grade:</strong> {selectedEffect.harmony_grade}</div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ancestryGroups.map(a=>({
                      label: a.label,
                      value: Number(selectedEffect[a.key] as any) || 0
                    }))}
                    layout="vertical"
                    margin={{ left:50, right:20, top:20, bottom:20 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize:12 }}
                      label={{ value:'Effect size', position:'insideBottom', offset:-10 }}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={120}
                      tick={{ fontSize:12 }}
                      label={{ value:'Ancestry', angle:-90, position:'insideLeft', dx:-20 }}
                    />
                    <RechartsTooltip formatter={(v:number)=>v.toFixed(3)}/>
                    <Bar dataKey="value" barSize={20}>
                      {ancestryGroups.map((a,i)=>(
                        <Cell key={a.key} fill={ANCESTRY_COLORS[a.key]}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
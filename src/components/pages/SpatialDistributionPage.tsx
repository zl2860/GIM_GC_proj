import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Maximize2,
  RotateCcw,
  Search,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import "./SpatialDistributionPage.css";

const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const DATA_ROOT = `${PUBLIC_BASE}/data/gsmap_spatial`;

const GSMAP_COLORS = ["#030303", "#0B1F4D", "#006DCC", "#00E5FF", "#FFF066", "#FF3B30"];
const FALLBACK_NICHE_COLOR = "#EDEDED";
const TOP_FILTERS = [
  { label: "All", value: "all", fraction: null, pathwayKey: null },
  { label: "50%", value: "0.5", fraction: 0.5, pathwayKey: "top50" },
  { label: "20%", value: "0.2", fraction: 0.2, pathwayKey: "top20" },
  { label: "10%", value: "0.1", fraction: 0.1, pathwayKey: "top10" },
];
const PATHWAY_DATASETS = [
  {
    id: "original",
    label: "by curated genesets",
    file: "pathway_enrichment.json",
  },
  {
    id: "tumor_core",
    label: "by genesets from databases",
    file: "tumor_core_pathway_enrichment.top50_terms.json",
  },
];
const PATHWAY_SOURCE_OPTIONS = [
  { value: "original", label: "by curated genesets" },
  { value: "tumor_core", label: "by genesets from databases" },
  { value: "combined", label: "combined sources" },
];
const COMBINED_PATHWAY_SOURCE_IDS = PATHWAY_DATASETS.map((item) => item.id);
const PATHWAY_PANEL_DEFAULT_Y = 154;
const TOOLTIP_MAX_WIDTH = 430;
const TRAIT_TOOLTIP_MAX_WIDTH = 760;
const MIN_POSITIVE_P = Number.MIN_VALUE;
const MAX_NEG_LOG10_P = -Math.log10(MIN_POSITIVE_P);
const EXCLUDED_SAMPLE_CASES = new Set(["gc6-pm"]);
const DECONVOLUTION_NOTE =
  "Cell-type proportions are inferred from Visium spot transcriptomes using a matched gastric cancer single-cell reference, then summarized into spatial niche categories.";
const GSMAP_SCORE_NOTE =
  "gsMap integrates spatial transcriptomics with GWAS summary statistics through stratified LD score regression. Higher trait relevance marks spots whose local expression specificity is more genetically associated with the selected trait; it is not gene expression, cell abundance, or pathway activity.";
const ENRICHMENT_METHOD_NOTE =
  "For the selected sample and trait, spots are ranked by gsMap trait relevance. The top 50/20/10% spots are compared with the remaining spots using pathway scores and a Wilcoxon/Mann-Whitney rank-sum test; BH FDR is controlled within each sample-trait-fraction. Positive-effect pathways with adjusted P <= 0.05 are shown.";
const PATHWAY_DELTA_NOTE =
  "Delta is the mean pathway score in the selected high-gsMap spots minus the mean score in the remaining spots. Positive values indicate higher pathway scores in the selected spots.";

function formatNumber(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return "NA";
  return Number(value).toFixed(digits);
}

function isDisplayableSample(item) {
  const caseName = String(item?.sample_meta?.gc_case || "").trim().toLowerCase();
  return !EXCLUDED_SAMPLE_CASES.has(caseName);
}

function publicAssetPath(src) {
  if (!src || /^https?:\/\//.test(src) || src.startsWith("data:")) return src;
  if (src.startsWith("/data/")) return `${PUBLIC_BASE}${src}`;
  return src;
}

function formatPercent(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "NA";
  return `${(number * 100).toFixed(digits)}%`;
}

function formatPValue(value) {
  if (value == null || Number.isNaN(Number(value))) return "NA";
  const number = Number(value);
  if (number === 0) return "0";
  if (number < 0.001) return number.toExponential(1);
  return number.toFixed(3);
}

function negLog10(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  if (number === 0) return MAX_NEG_LOG10_P;
  return -Math.log10(number);
}

function formatNegLog10P(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "NA";
  if (number === 0) return `>${formatNumber(MAX_NEG_LOG10_P, 0)}`;
  return formatNumber(-Math.log10(number), 1);
}

function getSignificantPathways(rows) {
  return (rows || [])
    .filter((item) => Number(item.effect ?? item.delta_mean ?? 0) > 0)
    .filter((item) => Number(item.fdr ?? item.fdr_q_value ?? 1) <= 0.05)
    .sort((a, b) => {
      const fdrDiff = Number(a.fdr ?? a.fdr_q_value ?? 1) - Number(b.fdr ?? b.fdr_q_value ?? 1);
      if (fdrDiff) return fdrDiff;
      return Number(b.effect ?? b.delta_mean ?? 0) - Number(a.effect ?? a.delta_mean ?? 0);
    });
}

function getPathwayDataset(id) {
  return PATHWAY_DATASETS.find((item) => item.id === id);
}

function getActivePathwaySourceIds(source) {
  if (source === "combined") return PATHWAY_DATASETS.map((item) => item.id);
  return [source];
}

function getPathwayRowsForKey(payload, pathwayKey) {
  if (!payload || !pathwayKey) return [];
  if (Array.isArray(payload)) {
    return pathwayKey === "top20" ? payload : [];
  }
  return payload[pathwayKey] || [];
}

function getPathwayLoadStatus(sourceIds, pathwayLoadState, pathwayDataBySource) {
  const states = sourceIds.map((sourceId) => pathwayLoadState[sourceId] || "idle");
  if (states.some((state) => state === "idle" || state === "loading")) return "pending";
  return sourceIds.some((sourceId) => pathwayDataBySource[sourceId]) ? "ready" : "pending";
}

function getPathwayLabel(item) {
  return item?.term || item?.source_term || item?.pathway || "Pathway";
}

function getPathwayTitle(item) {
  const label = getPathwayLabel(item);
  const source = item?.source_library || "";
  const category = item?.category || "";
  return [label, source, category].filter(Boolean).join(" | ");
}

function makeTopMask(values, fraction) {
  if (!values?.length || !fraction) return null;
  const finite = values
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value != null && Number.isFinite(Number(item.value)));
  if (!finite.length) return Array(values.length).fill(false);
  finite.sort((a, b) => Number(b.value) - Number(a.value));
  const topCount = Math.max(1, Math.ceil(finite.length * fraction));
  const mask = Array(values.length).fill(false);
  for (const item of finite.slice(0, topCount)) {
    mask[item.index] = true;
  }
  return mask;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function continuousColor(value, min, max) {
  if (value == null || min == null || max == null || max === min) return "#4b5563";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const values = [0, 0.18, 0.4, 0.62, 0.82, 1];
  let index = values.length - 2;
  for (let i = 0; i < values.length - 1; i += 1) {
    if (t >= values[i] && t <= values[i + 1]) {
      index = i;
      break;
    }
  }
  const local = (t - values[index]) / Math.max(0.0001, values[index + 1] - values[index]);
  const from = hexToRgb(GSMAP_COLORS[index]);
  const to = hexToRgb(GSMAP_COLORS[index + 1]);
  const rgb = from.map((start, channel) => Math.round(start + (to[channel] - start) * local));
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function getNicheColor(sample, code) {
  return sample?.niches?.meta?.[code]?.color || FALLBACK_NICHE_COLOR;
}

function getNicheLabel(sample, code) {
  const meta = sample?.niches?.meta?.[code];
  return meta?.niche_type || meta?.biological_label || meta?.niche_id || "Niche";
}

function getNicheShortLabel(label) {
  return String(label || "Niche")
    .replace("Unassigned", "Unasg")
    .replace("Fibroblast", "Fibro")
    .replace("Malignant", "Malig")
    .replace("Epithelium", "Epi")
    .replace(" infiltrated", "+")
    .replace(" dominant", "");
}

function getSpotDeconvolution(sample, index) {
  if (!sample?.deconvolution || index == null) return [];
  const cellTypes = sample.deconvolution.cell_types || [];
  const proportions = sample.deconvolution.proportions || {};
  return cellTypes
    .map((cell) => {
      const value = proportions[cell]?.[index];
      return { cell, value: Number(value) };
    })
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
}

function getSpotDominantCell(sample, index) {
  return sample?.deconvolution?.dominant_cell_type?.[index] || "";
}

function combineMasks(primaryMask, secondaryMask, length) {
  if (!primaryMask && !secondaryMask) return null;
  return Array.from({ length }, (_, index) => (
    (!primaryMask || Boolean(primaryMask[index])) && (!secondaryMask || Boolean(secondaryMask[index]))
  ));
}

function getSpotBounds(sample, mask = null) {
  if (!sample?.spots?.x?.length || !sample?.spots?.y?.length) return null;
  const xs = sample.spots.x;
  const ys = sample.spots.y;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (let i = 0; i < xs.length; i += 1) {
    if (mask && !mask[i]) continue;
    const x = Number(xs[i]);
    const y = Number(ys[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    count += 1;
  }

  if (!count && mask) return getSpotBounds(sample, null);
  if (!count) return null;
  return { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY };
}

function getBoundsKey(bounds) {
  if (!bounds) return "";
  return [bounds.min_x, bounds.max_x, bounds.min_y, bounds.max_y]
    .map((value) => Math.round(Number(value)))
    .join(":");
}

function getTooltipStyle(screenX, screenY, hasPathways) {
  if (typeof window === "undefined") return { left: screenX + 14, top: screenY + 14 };
  const margin = 12;
  const gap = 14;
  const maxWidth = hasPathways ? TRAIT_TOOLTIP_MAX_WIDTH : TOOLTIP_MAX_WIDTH;
  const width = Math.min(maxWidth, Math.max(240, window.innerWidth - margin * 2));
  const estimatedHeight = hasPathways ? 285 : 238;
  let left = screenX + gap;
  let top = screenY + gap;

  if (left + width > window.innerWidth - margin) {
    left = Math.max(margin, screenX - width - gap);
  }

  if (top + estimatedHeight > window.innerHeight - margin) {
    top = Math.max(margin, screenY - estimatedHeight - gap);
  }

  return {
    left,
    top,
    width,
    maxHeight: Math.max(180, window.innerHeight - top - margin),
  };
}

function drawSpotPolygon(ctx, x, y, radius) {
  const sides = 6;
  const angleOffset = Math.PI / 6;
  ctx.beginPath();
  for (let side = 0; side < sides; side += 1) {
    const angle = angleOffset + (side * Math.PI * 2) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (side === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function CanvasMap({
  sample,
  layer,
  trait,
  marker,
  focusIndex,
  view,
  onViewChange,
  label,
  caption,
  filterValues = [],
  filterFraction = null,
  includeMask = null,
  showActions = true,
  onHover,
  onSelect,
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ width: 960, height: 640 });
  const [localView, setLocalView] = useState(null);
  const activeView = view ?? localView;
  const updateView = onViewChange ?? setLocalView;

  const values = useMemo(() => {
    if (!sample) return [];
    if (layer === "marker") return sample.markers[marker] || [];
    if (layer === "niche") return sample.spots.niche_code || [];
    return sample.traits[trait] || [];
  }, [sample, layer, trait, marker]);

  const range = useMemo(() => {
    if (!sample || layer === "niche") return [null, null];
    const key = layer === "marker" ? marker : trait;
    const source = layer === "marker" ? sample.ranges.markers : sample.ranges.traits;
    return source[key] || [null, null];
  }, [sample, layer, trait, marker]);

  const topFilterMask = useMemo(
    () => makeTopMask(filterValues, filterFraction),
    [filterValues, filterFraction],
  );

  const fitBounds = useMemo(
    () => getSpotBounds(sample, topFilterMask),
    [sample, topFilterMask],
  );
  const fitBoundsKey = useMemo(() => getBoundsKey(fitBounds), [fitBounds]);

  const filterMask = useMemo(
    () => combineMasks(topFilterMask, includeMask, sample?.spot_count || values.length),
    [topFilterMask, includeMask, sample?.spot_count, values.length],
  );

  const fitView = useCallback(() => {
    if (!sample || !fitBounds) return null;
    const bounds = fitBounds;
    const dataWidth = Math.max(1, bounds.max_x - bounds.min_x);
    const dataHeight = Math.max(1, bounds.max_y - bounds.min_y);
    const scale = Math.min(size.width / dataWidth, size.height / dataHeight) * 0.985;
    return {
      scale,
      baseScale: scale,
      offsetX: (size.width - dataWidth * scale) / 2,
      offsetY: (size.height - dataHeight * scale) / 2,
      minX: bounds.min_x,
      minY: bounds.min_y,
      viewportWidth: size.width,
      viewportHeight: size.height,
      boundsKey: fitBoundsKey,
      autoFit: true,
    };
  }, [sample, fitBounds, fitBoundsKey, size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({
        width: Math.max(180, Math.floor(rect.width)),
        height: Math.max(180, Math.floor(rect.height)),
      });
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = fitView();
    if (!next) return;
    if (onViewChange) {
      const sizeChanged = view?.viewportWidth !== size.width || view?.viewportHeight !== size.height;
      const boundsChanged = view?.boundsKey !== next.boundsKey;
      if (!view || (view.autoFit !== false && (sizeChanged || boundsChanged))) onViewChange(next);
      return;
    }
    setLocalView(next);
  }, [fitView, onViewChange, size.height, size.width, view]);

  const project = useCallback(
    (x, y, currentView = activeView) => {
      if (!currentView) return [0, 0];
      return [
        (x - currentView.minX) * currentView.scale + currentView.offsetX,
        (y - currentView.minY) * currentView.scale + currentView.offsetY,
      ];
    },
    [activeView],
  );

  const draw = useCallback(() => {
    if (!sample || !activeView) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size.width * ratio;
    canvas.height = size.height * ratio;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size.width, size.height);

    const xs = sample.spots.x;
    const ys = sample.spots.y;
    const [min, max] = range;
    const zoomRatio = Math.max(0.62, Math.min(2.8, Math.sqrt(activeView.scale / activeView.baseScale)));
    const radius = Math.max(1.55, Math.min(5.9, 2.35 * zoomRatio));

    for (let i = 0; i < xs.length; i += 1) {
      if (filterMask && !filterMask[i]) continue;
      const [sx, sy] = project(xs[i], ys[i]);
      if (sx < -10 || sx > size.width + 10 || sy < -10 || sy > size.height + 10) continue;
      const value = values[i];
      drawSpotPolygon(ctx, sx, sy, radius);
      ctx.fillStyle =
        layer === "niche" ? getNicheColor(sample, value) : continuousColor(value, min, max);
      ctx.globalAlpha = 0.94;
      ctx.fill();
    }

    if (focusIndex != null && (!filterMask || filterMask[focusIndex])) {
      const [sx, sy] = project(xs[focusIndex], ys[focusIndex]);
      const boxSize = Math.max(11, radius * 5.2);
      ctx.globalAlpha = 1;
      drawSpotPolygon(ctx, sx, sy, Math.max(6.2, radius + 3.2));
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      drawSpotPolygon(ctx, sx, sy, Math.max(8.5, radius + 5.3));
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = "#ff3b30";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(sx - boxSize / 2, sy - boxSize / 2, boxSize, boxSize);
    }
    ctx.globalAlpha = 1;
  }, [sample, activeView, size, values, range, layer, focusIndex, filterMask, project]);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [draw]);

  const findNearest = useCallback(
    (event) => {
      if (!sample || !activeView) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      let best = null;
      let bestDistance = 100;
      const xs = sample.spots.x;
      const ys = sample.spots.y;
      for (let i = 0; i < xs.length; i += 1) {
        if (filterMask && !filterMask[i]) continue;
        const [sx, sy] = project(xs[i], ys[i]);
        const dx = sx - px;
        const dy = sy - py;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { index: i, x: event.clientX, y: event.clientY };
        }
      }
      return best;
    },
    [sample, activeView, filterMask, project],
  );

  const handleWheel = useCallback(
    (event) => {
      if (!activeView) return;
      event.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const zoom = Math.exp(-event.deltaY * 0.0012);
      const nextScale = Math.max(activeView.baseScale * 0.45, Math.min(activeView.baseScale * 45, activeView.scale * zoom));
      const dataX = (px - activeView.offsetX) / activeView.scale;
      const dataY = (py - activeView.offsetY) / activeView.scale;
      updateView({
        ...activeView,
        scale: nextScale,
        offsetX: px - dataX * nextScale,
        offsetY: py - dataY * nextScale,
        autoFit: false,
      });
    },
    [activeView, updateView],
  );

  const handlePointerDown = useCallback((event) => {
    canvasRef.current.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }, []);

  const handlePointerMove = useCallback(
    (event) => {
      if (dragRef.current && activeView) {
        const dx = event.clientX - dragRef.current.x;
        const dy = event.clientY - dragRef.current.y;
        dragRef.current.x = event.clientX;
        dragRef.current.y = event.clientY;
        updateView((current) => current ? ({
          ...current,
          offsetX: current.offsetX + dx,
          offsetY: current.offsetY + dy,
          autoFit: false,
        }) : current);
        return;
      }
      onHover(findNearest(event));
    },
    [findNearest, onHover, activeView, updateView],
  );

  const handlePointerUp = useCallback((event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }, []);

  const showColorScale = layer !== "niche" && range[0] != null && range[1] != null;

  return (
    <div className="map-shell">
      {label && (
        <div className="map-badge">
          <strong>{label}</strong>
          {caption && <span>{caption}</span>}
        </div>
      )}
      {showActions && (
        <div className="map-actions">
          <button type="button" title="Reset view" onClick={() => updateView(fitView())}>
            <RotateCcw size={16} />
          </button>
          <button type="button" title="Fit sample" onClick={() => updateView(fitView())}>
            <Maximize2 size={16} />
          </button>
        </div>
      )}
      {showColorScale && (
        <div className="map-colorscale" aria-label={`${label || "Map"} color scale`}>
          <div className="map-colorscale-bar" />
          <div className="map-colorscale-labels">
            <span>{formatNumber(range[0], 2)}</span>
            <span>{formatNumber(range[1], 2)}</span>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="spatial-canvas"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => onHover(null)}
        onClick={(event) => onSelect(findNearest(event)?.index ?? null)}
      />
    </div>
  );
}

function SliceNavigator({ sample, activeIndex }) {
  if (!sample?.image?.hires_src) {
    return (
      <section className="slice-panel">
        <h2>Slice</h2>
        <p className="muted">No histology image</p>
      </section>
    );
  }

  const imageX = activeIndex != null ? sample.spots.image_x[activeIndex] : null;
  const imageY = activeIndex != null ? sample.spots.image_y[activeIndex] : null;
  const left = imageX != null ? `${(imageX / sample.image.width) * 100}%` : "-100%";
  const top = imageY != null ? `${(imageY / sample.image.height) * 100}%` : "-100%";

  return (
    <section className="slice-panel">
      <div className="panel-heading">
        <h2>Slice</h2>
        <span>{sample.sample_meta?.gc_case || sample.sample_id}</span>
      </div>
      <div className="slice-frame">
        <img src={publicAssetPath(sample.image.hires_src)} alt={`${sample.sample_id} tissue slice`} />
        {imageX != null && imageY != null && <span className="slice-indicator" style={{ left, top }} />}
      </div>
    </section>
  );
}

function TraitRail({ traits, activeTrait, query, onQueryChange, onTraitChange }) {
  return (
    <aside className="trait-rail" aria-label="Trait selection">
      <div className="panel-heading">
        <h2>Trait</h2>
        <span>{traits.length}</span>
      </div>
      <div className="search-box trait-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter"
          aria-label="Filter traits"
        />
      </div>
      <div className="trait-list" role="listbox" aria-label="Traits">
        {traits.map((item) => (
          <button
            type="button"
            role="option"
            aria-selected={activeTrait === item}
            className={activeTrait === item ? "active" : ""}
            key={item}
            title={item}
            onClick={() => onTraitChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
    </aside>
  );
}

function SampleInfo({ sample, compact = false }) {
  const meta = sample?.sample_meta || {};
  if (compact) {
    return (
      <section className="sample-info-panel">
        <div className="panel-heading">
          <h2>Sample source</h2>
          <span>{meta.gc_case || "case"}</span>
        </div>
        <dl>
          <dt>Reference</dt>
          <dd>{meta.spatial_reference || "GSE251950 Visium gastric cancer spatial transcriptomics"}</dd>
          <dt>Subtype</dt>
          <dd>
            Lauren {meta.lauren_type || "unknown"}; TME {meta.spatial_tme_subtype || "unknown"}
          </dd>
          <dt>Signals</dt>
          <dd>
            Deconvolution-derived niche; gsMap trait relevance
          </dd>
          <dt>Deconvolution</dt>
          <dd>{DECONVOLUTION_NOTE}</dd>
        </dl>
      </section>
    );
  }

  return (
    <section className="sample-info-panel">
      <div className="panel-heading">
        <h2>Sample source</h2>
        <span>{meta.gc_case || "case"}</span>
      </div>
      <dl>
        <dt>Spatial data</dt>
        <dd>{meta.spatial_reference || "GSE251950 Visium gastric cancer spatial transcriptomics"}</dd>
        <dt>Lauren subtype</dt>
        <dd>{meta.lauren_type || "unknown"}</dd>
        <dt>Spatial TME subtype</dt>
        <dd>{meta.spatial_tme_subtype || "unknown"}</dd>
        <dt>Deconvolution</dt>
        <dd>{DECONVOLUTION_NOTE}</dd>
        <dt>gsMap source</dt>
        <dd>{meta.gsmap_reference || "H. pylori GWAS Catalog-to-gsMap workflow"}</dd>
      </dl>
    </section>
  );
}

function PathwaySummary({ pathways, pathwayStatus, pathwayKey }) {
  if (pathwayStatus === "pending") {
    return <p className="pathway-empty">Pathway export pending</p>;
  }

  if (!pathwayKey) {
    return <p className="pathway-empty">Select spots with top 50/20/10% GIM trait signals to see pathway enrichment information</p>;
  }

  const count = pathways?.length || 0;
  return (
    <p className="pathway-summary">
      <strong>{count}</strong>
      <span>significant {pathwayKey} pathways</span>
    </p>
  );
}

function TooltipPathways({ pathways }) {
  if (!pathways?.length) return null;
  const topRows = pathways.slice(0, 5);
  const scores = topRows.map((item) => negLog10(item.fdr ?? item.fdr_q_value));
  const maxScore = Math.max(1, ...scores.filter((score) => score != null));

  return (
    <div className="tooltip-pathways">
      <small>Top 5 pathways · combined sources · -log10(adj.P)</small>
      <ol>
        {topRows.map((item, index) => {
          const adjustedP = item.fdr ?? item.fdr_q_value;
          const score = scores[index];
          const width = score == null ? 0 : Math.max(4, (score / maxScore) * 100);
          const label = getPathwayLabel(item);
          return (
            <li key={`${item.pathway || item.term || index}-${index}`}>
              <span title={getPathwayTitle(item)}>{label}</span>
              <div className="tooltip-pathway-score">
                <i style={{ width: `${width}%` }} />
                <em>{formatNegLog10P(adjustedP)}</em>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TooltipDeconvolution({ rows, dominantCellType }) {
  if (!rows?.length) {
    return (
      <div className="tooltip-deconv">
        <small>Spot cell proportions</small>
        <p>No matched deconvolution proportion for this spot</p>
      </div>
    );
  }
  const maxValue = Math.max(0.001, ...rows.map((item) => item.value));

  return (
    <div className="tooltip-deconv">
      <small>Spot cell proportions</small>
      {dominantCellType && (
        <div className="tooltip-deconv-dominant">
          Dominant <b>{dominantCellType}</b>
        </div>
      )}
      <div className="tooltip-deconv-grid">
        {rows.map((item) => {
          const width = Math.max(3, (item.value / maxValue) * 100);
          return (
            <div className="tooltip-deconv-row" key={item.cell}>
              <span title={item.cell}>{item.cell}</span>
              <div className="tooltip-deconv-bar">
                <i style={{ width: `${width}%` }} />
                <em>{formatPercent(item.value)}</em>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PathwayInfoPanel({ pathways, pathwayStatus, trait, pathwayKey }) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: PATHWAY_PANEL_DEFAULT_Y });
  const [collapsed, setCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(224);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const getPanelBounds = useCallback(() => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    return {
      parentWidth: parent?.clientWidth || window.innerWidth,
      parentHeight: parent?.clientHeight || window.innerHeight,
      panelWidth: panel?.offsetWidth || 280,
      panelHeight: panel?.offsetHeight || 220,
    };
  }, []);

  const defaultPosition = useCallback(() => {
    const bounds = getPanelBounds();
    return {
      x: Math.max(0, bounds.parentWidth - bounds.panelWidth - 14),
      y: Math.max(0, Math.min(PATHWAY_PANEL_DEFAULT_Y, bounds.parentHeight - 160)),
    };
  }, [getPanelBounds]);

  useEffect(() => {
    setPosition(defaultPosition());
  }, [defaultPosition, trait]);

  const handlePointerDown = useCallback((event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
  }, [position]);

  const handlePointerMove = useCallback((event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const bounds = getPanelBounds();
    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    setPosition({
      x: Math.max(0, Math.min(nextX, bounds.parentWidth - bounds.panelWidth)),
      y: Math.max(0, Math.min(nextY, bounds.parentHeight - 96)),
    });
  }, [getPanelBounds]);

  const handlePointerUp = useCallback((event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }, []);

  const handleResizePointerDown = useCallback((event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      height: panelHeight,
    };
  }, [panelHeight]);

  const handleResizePointerMove = useCallback((event) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    const bounds = getPanelBounds();
    const nextHeight = resizeRef.current.height + event.clientY - resizeRef.current.startY;
    setPanelHeight(Math.max(154, Math.min(nextHeight, bounds.parentHeight - position.y - 14)));
  }, [getPanelBounds, position.y]);

  const handleResizePointerUp = useCallback((event) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  }, []);

  const count = pathways?.length || 0;

  return (
    <aside
      ref={panelRef}
      className={`pathway-info-panel ${collapsed ? "collapsed" : ""}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        "--pathway-panel-height": `${panelHeight}px`,
      } as CSSProperties}
      aria-label="Significant pathway enrichment"
    >
      <div
        className="pathway-info-header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div>
          <h2>Pathway info</h2>
          <span>{pathwayKey || "top spot subset"} enrichment</span>
        </div>
        <button
          type="button"
          title="Reset panel position"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPosition(defaultPosition())}
        >
          <RotateCcw size={13} />
        </button>
        <button
          type="button"
          title={collapsed ? "Expand pathway panel" : "Collapse pathway panel"}
          aria-expanded={!collapsed}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>
      {!collapsed && (
        <div className="pathway-info-body">
          {pathwayStatus === "pending" ? (
            <p className="pathway-empty">Pathway export pending</p>
          ) : !pathwayKey ? (
            <p className="pathway-empty">Select top 50/20/10% spots to show subset-specific enrichment.</p>
          ) : !count ? (
            <p className="pathway-empty">No significant enriched pathway</p>
          ) : (
            <>
              <div className="pathway-info-count">{count} significant pathways, BH adj.P &lt; 0.05</div>
              <div className="pathway-info-table" role="table">
                {pathways.map((item, index) => {
                  const label = getPathwayLabel(item);
                  return (
                    <div className="pathway-info-row" role="row" key={`${item.pathway || item.term}-${index}`}>
                      <span>{index + 1}</span>
                      <strong title={getPathwayTitle(item)}>{label}</strong>
                      <em title={item.source_library || ""}>
                        adj.P {formatPValue(item.fdr ?? item.fdr_q_value)}
                      </em>
                      <b title={PATHWAY_DELTA_NOTE}>Δ {formatNumber(item.effect ?? item.delta_mean, 2)}</b>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      {!collapsed && (
        <div
          className="pathway-resize-handle"
          role="separator"
          aria-label="Resize pathway panel"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      )}
    </aside>
  );
}

function TraitAnalysisPanel({
  topFilter,
  onTopFilterChange,
  topSpotCount,
  totalSpotCount,
  pathways,
  pathwayStatus,
  pathwayKey,
}) {
  const [noticeOpen, setNoticeOpen] = useState(false);

  return (
    <section className="trait-analysis-panel">
      <div className="panel-heading">
        <h2>
          Filter by high GIM trait signals
          <button
            type="button"
            className="notice-button"
            aria-expanded={noticeOpen}
            aria-label="What gsMap trait relevance represents"
            onClick={() => setNoticeOpen((current) => !current)}
          >
            !
          </button>
        </h2>
        <span>
          {topSpotCount}/{totalSpotCount}
        </span>
      </div>
      {noticeOpen && <p className="gsmap-notice">{GSMAP_SCORE_NOTE}</p>}
      <div className="top-filter-buttons" aria-label="High gsMap trait relevance spot filter">
        {TOP_FILTERS.map((item) => (
          <button
            type="button"
            key={item.value}
            className={topFilter === item.value ? "active" : ""}
            onClick={() => onTopFilterChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <PathwaySummary
        pathways={pathways}
        pathwayStatus={pathwayStatus}
        pathwayKey={pathwayKey}
      />
    </section>
  );
}

function NicheFilterControls({ sample, value, onChange, visibleCount, className = "" }) {
  if (!sample?.niches?.meta?.length) return null;
  const total = sample.spot_count || sample.spots?.spot_id?.length || 0;

  return (
    <div className={`niche-filter-controls ${className}`} aria-label="Niche category filter">
      <button
        type="button"
        className={value === "all" ? "active" : ""}
        onClick={() => onChange("all")}
        title={`All niche categories (${total} spots)`}
      >
        <span className="niche-filter-dot all" />
        <b>All</b>
      </button>
      {sample.niches.meta.map((item, index) => {
        const label = item.niche_type || item.biological_label || item.niche_id;
        const count = sample.niches.counts?.[index] || 0;
        const shortLabel = getNicheShortLabel(label);
        return (
          <button
            type="button"
            key={item.niche_id || index}
            className={value === String(index) ? "active" : ""}
            onClick={() => onChange(String(index))}
            title={`${label} (${count} spots)`}
          >
            <span
              className="niche-filter-dot"
              style={{ backgroundColor: item.color || getNicheColor(sample, index) }}
            />
            <b>{shortLabel}</b>
          </button>
        );
      })}
    </div>
  );
}

function DetailPanel({
  sample,
  displaySpot,
  status,
  layer,
  activeRange,
  compact = false,
  topFilter = "all",
  onTopFilterChange = null,
  topSpotCount = 0,
  pathways = [],
  pathwayStatus = "missing",
  pathwayKey = null,
}) {
  return (
    <aside className={`detail-panel ${compact ? "compact" : ""}`}>
      <section className="spot-info-panel">
        <div className="panel-heading">
          <h2>Spot</h2>
          <span>{status}</span>
        </div>
        {displaySpot ? (
          <dl>
            <dt>Barcode</dt>
            <dd>{displaySpot.spotId}</dd>
            <dt>Niche</dt>
            <dd>{displaySpot.niche.niche_type || displaySpot.niche.biological_label}</dd>
            <dt>Value</dt>
            <dd>{layer === "niche" ? displaySpot.niche.niche_id : formatNumber(displaySpot.value, 4)}</dd>
            {!compact && (
              <>
                <dt>Axis</dt>
                <dd>{displaySpot.niche.top_cell_states}</dd>
                <dt>Full-res coordinate</dt>
                <dd>
                  {displaySpot.x}, {displaySpot.y}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <p className="muted">No spot selected</p>
        )}
      </section>
      {compact && layer === "trait" && onTopFilterChange ? (
        <>
          <TraitAnalysisPanel
            topFilter={topFilter}
            onTopFilterChange={onTopFilterChange}
            topSpotCount={topSpotCount}
            totalSpotCount={sample?.spot_count || 0}
            pathways={pathways}
            pathwayStatus={pathwayStatus}
            pathwayKey={pathwayKey}
          />
        </>
      ) : layer !== "niche" && (
        <>
          <SampleInfo sample={sample} compact={compact} />
          <section className="color-info-panel">
            <h2>Color</h2>
            <div className="gradient-bar" />
            <div className="range-row">
              <span>{formatNumber(activeRange[0])}</span>
              <span>{formatNumber(activeRange[1])}</span>
            </div>
          </section>
        </>
      )}
      {layer === "niche" && <SampleInfo sample={sample} compact={compact} />}
    </aside>
  );
}

function SpatialDistributionPage() {
  const [searchParams] = useSearchParams();
  const [manifest, setManifest] = useState(null);
  const [sample, setSample] = useState(null);
  const [sampleId, setSampleId] = useState("");
  const [layer, setLayer] = useState("trait");
  const [trait, setTrait] = useState("");
  const [marker, setMarker] = useState("");
  const [hover, setHover] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [mapView, setMapView] = useState(null);
  const [topFilter, setTopFilter] = useState("all");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [pathwaySource, setPathwaySource] = useState("original");
  const [enrichmentNoticeOpen, setEnrichmentNoticeOpen] = useState(false);
  const [pathwayDataBySource, setPathwayDataBySource] = useState({});
  const [pathwayLoadState, setPathwayLoadState] = useState({});
  const pathwayRequestsRef = useRef(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DATA_ROOT}/manifest.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`manifest request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const visibleSamples = (data.samples || []).filter(isDisplayableSample);
        const nextManifest = { ...data, samples: visibleSamples };
        const requestedTrait = searchParams.get("trait")?.trim().toLowerCase();
        const requestedSample = searchParams.get("sample")?.trim().toLowerCase();
        const requestedLayer = searchParams.get("layer")?.trim().toLowerCase();
        const matchedTrait =
          data.traits.find((item) => item.toLowerCase() === requestedTrait) || data.traits[0] || "";
        const matchedSample =
          visibleSamples.find(
            (item) =>
              item.id.toLowerCase() === requestedSample ||
              item.sample_meta?.gc_case?.toLowerCase() === requestedSample,
          ) || visibleSamples[0];

        setManifest(nextManifest);
        setSampleId(matchedSample?.id || "");
        setTrait(matchedTrait);
        setMarker(data.markers[0] || "");
        if (requestedLayer === "niche" || requestedLayer === "trait") setLayer(requestedLayer);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!sampleId) return;
    let cancelled = false;
    setLoading(true);
    setSelectedIndex(null);
    setNicheFilter("all");
    fetch(`${DATA_ROOT}/samples/${sampleId}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`sample request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setSample(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sampleId]);

  useEffect(() => {
    if (!manifest?.samples?.length) return;
    const sampleIsVisible = manifest.samples.some((item) => item.id === sampleId);
    if (!sampleIsVisible) {
      setSampleId(manifest.samples[0]?.id || "");
    }
  }, [manifest, sampleId]);

  useEffect(() => {
    setMapView(null);
  }, [sampleId, layer]);

  useEffect(() => {
    setSelectedIndex(null);
    setHover(null);
  }, [sampleId, trait, topFilter, nicheFilter, layer]);

  useEffect(() => {
    const sourcesToLoad = [...new Set([...getActivePathwaySourceIds(pathwaySource), ...COMBINED_PATHWAY_SOURCE_IDS])];

    sourcesToLoad.forEach((sourceId) => {
      if (pathwayRequestsRef.current.has(sourceId) || pathwayDataBySource[sourceId]) return;

      const dataset = getPathwayDataset(sourceId);
      if (!dataset) return;

      pathwayRequestsRef.current.add(sourceId);
      setPathwayLoadState((current) => ({ ...current, [sourceId]: "loading" }));

      fetch(`${DATA_ROOT}/${dataset.file}`)
        .then((response) => {
          if (response.status === 404) return null;
          if (!response.ok) throw new Error(`pathway request failed: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (!data) {
            setPathwayLoadState((current) => ({ ...current, [sourceId]: "missing" }));
            return;
          }
          setPathwayDataBySource((current) => ({ ...current, [sourceId]: data }));
          setPathwayLoadState((current) => ({ ...current, [sourceId]: "ready" }));
        })
        .catch(() => {
          setPathwayLoadState((current) => ({ ...current, [sourceId]: "missing" }));
        });
    });
  }, [pathwaySource, pathwayDataBySource]);

  const activeValues = useMemo(() => {
    if (!sample) return [];
    if (layer === "marker") return sample.markers[marker] || [];
    if (layer === "niche") return sample.spots.niche_code || [];
    return sample.traits[trait] || [];
  }, [sample, layer, trait, marker]);

  const activeRange = useMemo(() => {
    if (!activeValues.length || layer === "niche") return [null, null];
    const clean = activeValues.filter((v) => v != null);
    return [Math.min(...clean), Math.max(...clean)];
  }, [activeValues, layer]);

  const topFilterSpec = TOP_FILTERS.find((item) => item.value === topFilter) || TOP_FILTERS[0];
  const traitValues = sample?.traits?.[trait] || [];
  const traitTopMask = useMemo(
    () => makeTopMask(traitValues, topFilterSpec.fraction),
    [traitValues, topFilterSpec.fraction],
  );
  const topSpotCount = traitTopMask ? traitTopMask.filter(Boolean).length : sample?.spot_count || 0;
  const activePathwaySourceIds = useMemo(() => getActivePathwaySourceIds(pathwaySource), [pathwaySource]);
  const pathwayStatus = useMemo(
    () => getPathwayLoadStatus(activePathwaySourceIds, pathwayLoadState, pathwayDataBySource),
    [activePathwaySourceIds, pathwayDataBySource, pathwayLoadState],
  );
  const combinedPathwayStatus = useMemo(
    () => getPathwayLoadStatus(COMBINED_PATHWAY_SOURCE_IDS, pathwayLoadState, pathwayDataBySource),
    [pathwayDataBySource, pathwayLoadState],
  );
  const pathwayRows = useMemo(() => {
    if (!topFilterSpec.pathwayKey) return [];

    return activePathwaySourceIds.flatMap((sourceId) => {
      const payload = pathwayDataBySource[sourceId]?.results?.[sampleId]?.[trait];
      return getPathwayRowsForKey(payload, topFilterSpec.pathwayKey).map((item) => ({
        ...item,
        enrichment_source: sourceId,
      }));
    });
  }, [activePathwaySourceIds, pathwayDataBySource, sampleId, topFilterSpec.pathwayKey, trait]);
  const significantPathways = useMemo(() => getSignificantPathways(pathwayRows), [pathwayRows]);
  const tooltipPathwayRows = useMemo(() => {
    if (!topFilterSpec.pathwayKey || combinedPathwayStatus !== "ready") return [];

    return COMBINED_PATHWAY_SOURCE_IDS.flatMap((sourceId) => {
      const payload = pathwayDataBySource[sourceId]?.results?.[sampleId]?.[trait];
      return getPathwayRowsForKey(payload, topFilterSpec.pathwayKey).map((item) => ({
        ...item,
        enrichment_source: sourceId,
      }));
    });
  }, [combinedPathwayStatus, pathwayDataBySource, sampleId, topFilterSpec.pathwayKey, trait]);
  const tooltipPathways = useMemo(() => getSignificantPathways(tooltipPathwayRows), [tooltipPathwayRows]);
  const nicheCategoryMask = useMemo(() => {
    if (!sample || nicheFilter === "all") return null;
    const code = Number(nicheFilter);
    return sample.spots.niche_code.map((item) => Number(item) === code);
  }, [sample, nicheFilter]);
  const nicheVisibleMask = useMemo(
    () => layer === "trait"
      ? combineMasks(traitTopMask, nicheCategoryMask, sample?.spot_count || 0)
      : nicheCategoryMask,
    [layer, traitTopMask, nicheCategoryMask, sample?.spot_count],
  );
  const nicheVisibleCount = nicheVisibleMask
    ? nicheVisibleMask.filter(Boolean).length
    : sample?.spot_count || 0;
  const activeNicheFilterLabel = nicheFilter === "all"
    ? "all niches"
    : getNicheLabel(sample, Number(nicheFilter));
  const nicheCaption = topFilterSpec.fraction && layer === "trait"
    ? `Deconvolution niche · top ${topFilterSpec.label} · ${activeNicheFilterLabel}`
    : `Deconvolution niche · ${activeNicheFilterLabel}`;

  const selected = selectedIndex != null && sample
    ? {
        index: selectedIndex,
        spotId: sample.spots.spot_id[selectedIndex],
        x: sample.spots.x[selectedIndex],
        y: sample.spots.y[selectedIndex],
        niche: sample.niches.meta[sample.spots.niche_code[selectedIndex]],
        value: activeValues[selectedIndex],
        deconvolution: getSpotDeconvolution(sample, selectedIndex),
        dominantCellType: getSpotDominantCell(sample, selectedIndex),
      }
    : null;

  const hoverInfo = hover?.index != null && sample
    ? {
        index: hover.index,
        spotId: sample.spots.spot_id[hover.index],
        x: sample.spots.x[hover.index],
        y: sample.spots.y[hover.index],
        niche: sample.niches.meta[sample.spots.niche_code[hover.index]],
        value: activeValues[hover.index],
        screenX: hover.x,
        screenY: hover.y,
        source: hover.source,
        deconvolution: getSpotDeconvolution(sample, hover.index),
        dominantCellType: getSpotDominantCell(sample, hover.index),
      }
    : null;

  const activeIndex = hoverInfo?.index ?? selectedIndex;
  const displaySpot = selected || hoverInfo;
  const spotStatus = selected ? "selected" : hoverInfo ? "hover" : "";
  const sampleMeta = sample?.sample_meta || {};
  const tooltipHasPathways = Boolean(hoverInfo && layer === "trait" && hoverInfo.source === "gsmap");

  if (error) {
    return (
      <div className="spatial-page">
        <main className="center-state">
          <h1>Spatial distribution</h1>
          <p>{error}</p>
        </main>
      </div>
    );
  }

  if (!manifest || (loading && !sample)) {
    return (
      <div className="spatial-page">
        <main className="center-state">
          <Loader2 className="spin" size={28} />
          <p>Loading spatial data</p>
        </main>
      </div>
    );
  }

  return (
    <div className="spatial-page">
    <main className="app">
      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <h2>Spatial distribution</h2>
            <p title={`${sampleMeta.gc_case || sampleId} | Lauren: ${sampleMeta.lauren_type || "unknown"} | TME: ${sampleMeta.spatial_tme_subtype || "unknown"} | ${sampleMeta.spatial_reference || "GSE251950 Visium gastric cancer spatial transcriptomics"}`}>
              {sampleMeta.gc_case || sampleId} | Lauren: {sampleMeta.lauren_type || "unknown"} | TME: {sampleMeta.spatial_tme_subtype || "unknown"} | {sampleMeta.spatial_reference || "GSE251950 Visium gastric cancer spatial transcriptomics"}
            </p>
          </div>
          <div className="topbar-controls">
            <label className="topbar-control">
              <span>Sample</span>
              <select value={sampleId} onChange={(event) => setSampleId(event.target.value)}>
                {manifest.samples.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.sample_meta?.gc_case || item.id} | {item.sample_meta?.lauren_type || "unknown"}
                  </option>
                ))}
              </select>
            </label>
            <div className="topbar-mode" aria-label="Layer">
              <button type="button" className={layer === "trait" ? "active" : ""} onClick={() => setLayer("trait")}>
                <Activity size={14} />
                GIM signals
              </button>
            </div>
            {layer === "trait" && (
              <>
                <label className="topbar-control trait-selector-control">
                  <span>Trait</span>
                  <select
                    value={trait}
                    aria-label="Select trait"
                    onChange={(event) => setTrait(event.target.value)}
                  >
                    {manifest.traits.map((item) => (
                      <option value={item} key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="topbar-control pathway-source-control">
                  <span className="control-label-with-help">
                    Enrichment
                    <button
                      type="button"
                      className="inline-help-button"
                      aria-label="Enrichment method"
                      aria-expanded={enrichmentNoticeOpen}
                      title={ENRICHMENT_METHOD_NOTE}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setEnrichmentNoticeOpen((current) => !current);
                      }}
                    >
                      <Info size={11} />
                    </button>
                  </span>
                  <select
                    value={pathwaySource}
                    aria-label="Enrichment source"
                    onChange={(event) => setPathwaySource(event.target.value)}
                  >
                    {PATHWAY_SOURCE_OPTIONS.map((item) => (
                      <option value={item.value} key={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {enrichmentNoticeOpen && (
                    <p className="enrichment-method-notice">
                      {ENRICHMENT_METHOD_NOTE}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        <div className={`visual-layout ${layer === "trait" ? "trait-layout" : ""}`}>
          <div className={`map-stage ${layer === "trait" ? "with-trait-rail" : ""}`}>
            {layer === "trait" ? (
              <div className="trait-visual-stack">
                <div className="trait-top-strip">
                  <DetailPanel
                    sample={sample}
                    displaySpot={displaySpot}
                    status={spotStatus}
                    layer={layer}
                    activeRange={activeRange}
                    compact
                    topFilter={topFilter}
                    onTopFilterChange={setTopFilter}
                    topSpotCount={topSpotCount}
                    pathways={significantPathways}
                    pathwayStatus={pathwayStatus}
                    pathwayKey={topFilterSpec.pathwayKey}
                  />
                  <div className="map-slice-dock">
                    <SliceNavigator sample={sample} activeIndex={activeIndex} />
                  </div>
                </div>
                <div className="map-pair-grid">
                  <div className="map-canvas-wrap">
                    <CanvasMap
                      sample={sample}
                      layer="trait"
                      trait={trait}
                      marker={marker}
                      focusIndex={activeIndex}
                      view={mapView}
                      onViewChange={setMapView}
                      label="GIM trait signals"
                      caption={topFilterSpec.fraction ? `top ${topFilterSpec.label} spots` : undefined}
                      filterValues={traitValues}
                      filterFraction={topFilterSpec.fraction}
                      showActions
                      onHover={(point) => setHover(point ? { ...point, source: "gsmap" } : null)}
                      onSelect={setSelectedIndex}
                    />
                  </div>
                  <div className="map-canvas-wrap">
                    <CanvasMap
                      sample={sample}
                      layer="niche"
                      trait={trait}
                      marker={marker}
                      focusIndex={activeIndex}
                      view={mapView}
                      onViewChange={setMapView}
                      label="Niche"
                      caption={topFilterSpec.fraction ? `top ${topFilterSpec.label} spots · ${activeNicheFilterLabel}` : activeNicheFilterLabel}
                      filterValues={traitValues}
                      filterFraction={topFilterSpec.fraction}
                      includeMask={nicheCategoryMask}
                      showActions={false}
                      onHover={(point) => setHover(point ? { ...point, source: "niche" } : null)}
                      onSelect={setSelectedIndex}
                    />
                    <NicheFilterControls
                      sample={sample}
                      value={nicheFilter}
                      onChange={setNicheFilter}
                      visibleCount={nicheVisibleCount}
                    />
                  </div>
                </div>
                <PathwayInfoPanel
                  pathways={significantPathways}
                  pathwayStatus={pathwayStatus}
                  trait={trait}
                  pathwayKey={topFilterSpec.pathwayKey}
                />
              </div>
            ) : (
              <div className="map-canvas-wrap">
                <CanvasMap
                  sample={sample}
                  layer={layer}
                  trait={trait}
                  marker={marker}
                  focusIndex={activeIndex}
                  view={mapView}
                  onViewChange={setMapView}
                  label="Niche"
                  caption={nicheCaption}
                  includeMask={layer === "niche" ? nicheCategoryMask : undefined}
                  showActions
                  onHover={(point) => setHover(point ? { ...point, source: layer } : null)}
                  onSelect={setSelectedIndex}
                />
                <SliceNavigator sample={sample} activeIndex={activeIndex} />
                {layer === "niche" && (
                  <NicheFilterControls
                    sample={sample}
                    value={nicheFilter}
                    onChange={setNicheFilter}
                    visibleCount={nicheVisibleCount}
                    className="below-slice"
                  />
                )}
              </div>
            )}
          </div>

          {layer !== "trait" && (
            <DetailPanel
              sample={sample}
              displaySpot={displaySpot}
              status={spotStatus}
              layer={layer}
              activeRange={activeRange}
            />
          )}
        </div>
      </section>

      {hoverInfo && (
        <div
          className={`tooltip ${tooltipHasPathways ? "trait-tooltip" : ""}`}
          style={getTooltipStyle(
            hoverInfo.screenX,
            hoverInfo.screenY,
            tooltipHasPathways,
          )}
        >
          <div className="tooltip-spot-summary">
            <div>
              <strong>{hoverInfo.spotId}</strong>
              <span>{hoverInfo.niche.niche_type || hoverInfo.niche.biological_label}</span>
            </div>
            <em>
              {layer === "niche" || hoverInfo.source === "niche"
                ? hoverInfo.niche.niche_id
                : formatNumber(hoverInfo.value, 4)}
            </em>
          </div>
          {tooltipHasPathways ? (
            <div className="tooltip-content-grid">
              <TooltipDeconvolution
                rows={hoverInfo.deconvolution}
                dominantCellType={hoverInfo.dominantCellType}
              />
              <TooltipPathways pathways={tooltipPathways} />
            </div>
          ) : (
            <TooltipDeconvolution
              rows={hoverInfo.deconvolution}
              dominantCellType={hoverInfo.dominantCellType}
            />
          )}
        </div>
      )}
    </main>
    </div>
  );
}

export default SpatialDistributionPage;

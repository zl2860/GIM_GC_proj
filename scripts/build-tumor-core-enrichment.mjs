import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const archivePath = path.resolve(repoRoot, process.argv[2] || "krg_tumor_core_full_20260624_133444.tar.gz");
const outputDir = path.resolve(repoRoot, "public/data/gsmap_spatial");
const rowLimitPerGroup = Number(process.argv[3] || 50);
const fdrThreshold = 0.05;

const sourceFiles = [
  "krg_tumor_core_full_20260624_133444/outputs/pathway_enrichment_kegg_reactome_go_tumor_core_top20.primary_gc9.csv",
  "krg_tumor_core_full_20260624_133444/outputs/pathway_enrichment_kegg_reactome_go_tumor_core_top10_top50.primary_gc9.csv",
];

const groupSeparator = "\u001f";
const retainedByGroup = new Map();
const statsByGroup = new Map();
const sourceRows = {};

function toNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function groupKey(row) {
  return [row.sample_id, row.trait, row.top_label].join(groupSeparator);
}

function isBetter(candidate, current) {
  const fdrDiff = candidate.fdr - current.fdr;
  if (fdrDiff !== 0) return fdrDiff < 0;
  return candidate.effect > current.effect;
}

function keepTopRows(key, row) {
  const rows = retainedByGroup.get(key) || [];
  if (rows.length < rowLimitPerGroup) {
    rows.push(row);
    retainedByGroup.set(key, rows);
    return;
  }

  let worstIndex = 0;
  for (let index = 1; index < rows.length; index += 1) {
    if (isBetter(rows[worstIndex], rows[index])) worstIndex = index;
  }

  if (isBetter(row, rows[worstIndex])) rows[worstIndex] = row;
}

async function readSourceFile(sourceFile) {
  const tar = spawn("tar", ["-xOzf", archivePath, sourceFile]);
  const parser = Papa.parse(Papa.NODE_STREAM_INPUT, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  sourceRows[sourceFile] = { scanned: 0, significant: 0 };

  parser.on("data", (rawRow) => {
    sourceRows[sourceFile].scanned += 1;

    const fdr = toNumber(rawRow.fdr, 1);
    const effect = toNumber(rawRow.effect, 0);
    if (fdr == null || effect == null || fdr > fdrThreshold || effect <= 0) return;

    sourceRows[sourceFile].significant += 1;

    const key = groupKey(rawRow);
    const stats = statsByGroup.get(key) || {
      sample_id: rawRow.sample_id,
      trait: rawRow.trait,
      top_label: rawRow.top_label,
      top_fraction: toNumber(rawRow.top_fraction),
      significant_count: 0,
      retained_count: 0,
    };
    stats.significant_count += 1;
    statsByGroup.set(key, stats);

    keepTopRows(key, {
      pathway: rawRow.pathway,
      term: rawRow.source_term || rawRow.pathway,
      source_library: rawRow.source_library || "",
      source_term: rawRow.source_term || "",
      tier: rawRow.tier || "",
      category: rawRow.category || "",
      fdr,
      p_value: toNumber(rawRow.p_value),
      effect,
      top_mean: toNumber(rawRow.top_mean),
      background_mean: toNumber(rawRow.background_mean),
      n_top: toNumber(rawRow.n_top),
      n_background: toNumber(rawRow.n_background),
      direction: rawRow.direction || "",
      top_fraction: toNumber(rawRow.top_fraction),
      top_label: rawRow.top_label,
    });
  });

  tar.stderr.on("data", () => {});
  tar.stdout.pipe(parser);

  await new Promise((resolve, reject) => {
    parser.on("end", resolve);
    parser.on("error", reject);
    tar.on("error", reject);
    tar.on("close", (code) => {
      if (code && code !== 0 && code !== 141) {
        reject(new Error(`tar exited with code ${code} for ${sourceFile}`));
      }
    });
  });
}

for (const sourceFile of sourceFiles) {
  await readSourceFile(sourceFile);
}

const results = {};
const stats = {};
const flatRows = [];

for (const [key, rows] of retainedByGroup.entries()) {
  const [sampleId, trait, topLabel] = key.split(groupSeparator);
  rows.sort((a, b) => {
    const fdrDiff = a.fdr - b.fdr;
    if (fdrDiff) return fdrDiff;
    return b.effect - a.effect;
  });

  const groupStats = statsByGroup.get(key);
  groupStats.retained_count = rows.length;

  results[sampleId] ||= {};
  results[sampleId][trait] ||= {};
  results[sampleId][trait][topLabel] = rows;

  stats[sampleId] ||= {};
  stats[sampleId][trait] ||= {};
  stats[sampleId][trait][topLabel] = {
    significant_count: groupStats.significant_count,
    retained_count: groupStats.retained_count,
    top_fraction: groupStats.top_fraction,
  };

  rows.forEach((row, index) => {
    flatRows.push({
      sample_id: sampleId,
      trait,
      rank: index + 1,
      ...row,
      significant_count: groupStats.significant_count,
      retained_count: groupStats.retained_count,
    });
  });
}

const totalSignificantCount = [...statsByGroup.values()].reduce(
  (total, item) => total + item.significant_count,
  0,
);
const retainedCount = flatRows.length;
const outputBase = `tumor_core_pathway_enrichment.top${rowLimitPerGroup}_terms`;
const payload = {
  version: 1,
  generated_at: new Date().toISOString(),
  source_label: "Database genesets (KEGG/Reactome/GO)",
  source_archive: path.basename(archivePath),
  source_files: sourceFiles,
  method:
    "Top gsMap spots vs remaining spots; retained rows are positive-effect pathways with BH FDR <= 0.05, limited to the strongest terms per sample-trait-top-fraction group for web delivery.",
  fdr_threshold: fdrThreshold,
  row_limit_per_group: rowLimitPerGroup,
  total_significant_count: totalSignificantCount,
  row_count: retainedCount,
  source_rows: sourceRows,
  results,
  stats,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, `${outputBase}.json`), JSON.stringify(payload));
fs.writeFileSync(path.join(outputDir, `${outputBase}.csv`), Papa.unparse(flatRows, { newline: "\n" }));

console.log(
  `Wrote ${retainedCount} retained rows from ${totalSignificantCount} significant tumor-core rows to ${path.relative(
    repoRoot,
    path.join(outputDir, `${outputBase}.json`),
  )}`,
);

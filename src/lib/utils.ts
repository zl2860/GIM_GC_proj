import { clsx, ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TITLE_CASE_PRESERVE_WORDS = new Set([
  'BMI',
  'CADD',
  'CSL',
  'GC',
  'GGM',
  'GIM',
  'GIMs',
  'GWAS',
  'HGIN',
  'LC-MS',
  'MITS',
  'MR',
  'NMR',
  'PPI',
  'QTL',
  'R²',
  'RR',
  'RegulomeDB',
  'SIT',
  'UGCED',
  'UKBB',
  'eQTL',
  'mGWAS',
  'sQTL'
]);

const TITLE_CASE_PRESERVE_PREFIXES = ['GIMs-', 'LC-MS-', 'NMR-', 'P-value'];

export function toSentenceCaseTitle(text: string) {
  let seenWord = false;

  return text.replace(/[A-Za-z0-9²]+(?:[-/][A-Za-z0-9²]+)*|[A-Za-z]+/g, word => {
    if (
      TITLE_CASE_PRESERVE_WORDS.has(word) ||
      TITLE_CASE_PRESERVE_PREFIXES.some(prefix => word.startsWith(prefix))
    ) {
      seenWord = true;
      return word;
    }

    const lowered = word.toLowerCase();
    if (!seenWord) {
      seenWord = true;
      return lowered.charAt(0).toUpperCase() + lowered.slice(1);
    }

    return lowered;
  });
}

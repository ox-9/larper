import type { ExtractedGuideline } from "./types";

/**
 * Client-side PDF text extraction using pdfjs-dist.
 * No server, no AI, no Python — runs entirely in the browser.
 */

// We import pdfjs-dist dynamically so it's only loaded when needed
type PDFDocumentProxy = {
  numPages: number;
  getPage: (num: number) => Promise<{
    getTextContent: () => Promise<{
      items: Array<{ str: string; transform: number[]; width?: number; height?: number; dir?: string }>;
    }>;
  }>;
  destroy: () => void;
};

let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function loadPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    // Set worker source — use the CDN fallback so we don't need to copy the worker file
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

export interface ClientExtractionResult {
  text: string;
  pages: string[];
  pageCount: number;
  sections: ExtractedGuideline[];
}

/** Extract all text from a PDF file, page by page */
export async function extractTextFromPDFClient(file: File): Promise<{
  text: string;
  pages: string[];
  pageCount: number;
}> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: arrayBuffer }) as unknown as PDFDocumentProxy;

  const pages: string[] = [];
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    pages.push(pageText);
    pageTexts.push(`--- Page ${i} ---\n${pageText}`);
  }

  pdf.destroy();

  return {
    text: pageTexts.join("\n\n"),
    pages,
    pageCount: pdf.numPages,
  };
}

/** Detect severity from guideline text */
function detectSeverity(text: string): "critical" | "standard" | "informational" {
  const lower = text.toLowerCase();

  const criticalPatterns = [
    /\bmust\b/, /\bshall\b/, /\brequired\b/, /\bmandatory\b/,
    /\bprohibited\b/, /\bnot allowed\b/, /\bmust not\b/, /\bshall not\b/,
    /\bineligible\b/, /\bnot eligible\b/, /\bnot permitted\b/,
    /\bmay not\b/, /\bcannot\b/, /\bno\s+\w+\s+(?:may|allowed|permitted|accepted)\b/i,
    /\bdisqualif/i, /\bexcluded?\b/i,
  ];

  for (const pattern of criticalPatterns) {
    if (pattern.test(lower)) return "critical";
  }

  if (/\b(ltv|cltv|hcltv|dti|fico)\s*(?:is|must|shall|of|at|maximum|minimum)?\s*\(?\s*\d+/i.test(lower) ||
      /\$\d{1,3}(,\d{3})+/.test(lower) ||
      /\d+(?:\.\d+)?%/.test(lower)) {
    return "critical";
  }

  const informationalPatterns = [
    /\bnote:?\b/i, /\bguidance\b/i, /\bconsider\b/i,
    /\boptional\b/i, /\bclarification\b/i, /\bfor information\b/i,
    /\bmay\b(?! not)/i,
  ];

  for (const pattern of informationalPatterns) {
    if (pattern.test(lower)) return "informational";
  }

  return "standard";
}

/** Detect category from guideline text */
function detectCategory(text: string): string {
  const lower = text.toLowerCase();

  const categories: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\b(credit\s*score|fico|credit\s*history|credit\s*report|credit\s*bureau)\b/i, name: "Credit Requirements" },
    { pattern: /\b(ltv|ltv\s*ratio|loan\s*to\s*value|cltv|hcltv|combined\s*ltv)\b/i, name: "LTV/CLTV" },
    { pattern: /\b(dti|debt\s*to\s*income|income\s*ratio|qualification\s*ratio)\b/i, name: "Income & DTI" },
    { pattern: /\b(income|w-?\s*2|paystub|tax\s*return|bank\s*statement|self\s*employ)\b/i, name: "Income Documentation" },
    { pattern: /\b(appraisal|appraised\s*value|property\s*value|property\s*type|condo|sfr|pud)\b/i, name: "Property" },
    { pattern: /\b(loan\s*limit|loan\s*amount|max\s*loan|conforming|jumbo)\b/i, name: "Loan Limits" },
    { pattern: /\b(bankruptcy|foreclosure|short\s*sale|deed\s*in\s*lieu|seasoning|waiting\s*period)\b/i, name: "Credit Events" },
    { pattern: /\b(interest\s*rate|rate\s*lock|pricing|margin|adjustment)\b/i, name: "Pricing" },
    { pattern: /\b(dscr|debt\s*service\s*coverage|noi|net\s*operating)\b/i, name: "DSCR" },
    { pattern: /\b(escrow|impound|taxes|insurance|hazard|flood)\b/i, name: "Escrow & Insurance" },
    { pattern: /\b(closing|disclosure|trid|tila|respa|fee|cost)\b/i, name: "Closing" },
    { pattern: /\b(borrower|co-borrower|occupancy|primary\s*residence|second\s*home|investment)\b/i, name: "Borrower Eligibility" },
  ];

  for (const { pattern, name } of categories) {
    if (pattern.test(lower)) return name;
  }

  return "General";
}

/** Parse extracted text into structured guidelines */
function parseGuidelinesFromText(
  fullText: string,
  pages: string[],
  documentType: "A" | "B"
): ExtractedGuideline[] {
  const guidelines: ExtractedGuideline[] = [];
  let idCounter = 1;

  // Strategy 1: Split by numbered sections (e.g., "1.1 Title", "Section 2.3")
  const sectionPattern = /(?:^|\n)\s*((?:section\s+)?(?:\d+\.)*\d+[\.\)]\s+[A-Z][^\n]+)/gi;
  const sectionMatches = [...fullText.matchAll(sectionPattern)];

  if (sectionMatches.length >= 3) {
    // We have good section headers — use them
    for (let i = 0; i < sectionMatches.length; i++) {
      const match = sectionMatches[i];
      const heading = match[1].trim();
      const startIdx = match.index! + match[0].length;
      const endIdx = i + 1 < sectionMatches.length ? sectionMatches[i + 1].index! : fullText.length;
      const content = fullText.slice(startIdx, endIdx).trim();

      if (content.length < 20) continue; // Skip empty/too-short sections

      // Find which page this section is on
      const pageIdx = findPageIndex(pages, match.index!, fullText);

      guidelines.push({
        id: `guideline-${documentType}-${idCounter++}`,
        category: detectCategory(heading + " " + content),
        guideline: content.slice(0, 1000), // Cap length
        severity: detectSeverity(content),
        sourceDocument: documentType,
        pages: [pageIdx + 1],
        page_reference: String(pageIdx + 1),
      });
    }
  }

  // Strategy 2: If section parsing didn't yield enough, split by paragraphs
  if (guidelines.length < 3) {
    guidelines.length = 0; // Reset

    // Split text into meaningful paragraphs
    const paragraphs = fullText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30 && p.length < 2000); // Not too short, not too long

    let currentPage = 1;
    const pageLengths = pages.map((p) => p.length);
    const cumulativeLengths: number[] = [];
    let cumSum = 0;
    for (const len of pageLengths) {
      cumSum += len;
      cumulativeLengths.push(cumSum);
    }

    for (const para of paragraphs) {
      // Find which page this paragraph starts on
      const paraStart = fullText.indexOf(para);
      let pageNum = 1;
      for (let i = 0; i < cumulativeLengths.length; i++) {
        if (paraStart >= cumulativeLengths[i] - pageLengths[i] * 0.5) {
          pageNum = i + 1;
        }
      }

      // Skip short lines that are just headers/footers
      if (para.length < 40 && !/\d/.test(para)) continue;

      guidelines.push({
        id: `guideline-${documentType}-${idCounter++}`,
        category: detectCategory(para),
        guideline: para.slice(0, 1000),
        severity: detectSeverity(para),
        sourceDocument: documentType,
        pages: [pageNum],
        page_reference: String(pageNum),
      });
    }
  }

  // Deduplicate guidelines that are very similar
  return deduplicateGuidelines(guidelines);
}

/** Find which page a character index falls on */
function findPageIndex(pages: string[], charIndex: number, fullText: string): number {
  let runningLen = 0;
  for (let i = 0; i < pages.length; i++) {
    runningLen += pages[i].length + 20; // account for separator
    if (charIndex < runningLen) return i;
  }
  return pages.length - 1;
}

/** Remove near-duplicate guidelines */
function deduplicateGuidelines(guidelines: ExtractedGuideline[]): ExtractedGuideline[] {
  const seen = new Set<string>();
  return guidelines.filter((g) => {
    // Create a simple fingerprint from the first 100 chars, lowercased and whitespace-normalized
    const fingerprint = g.guideline.toLowerCase().replace(/\s+/g, " ").slice(0, 100);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

/** Main extraction function — pure client-side, no AI needed */
export async function extractGuidelinesFromPDFClient(
  file: File,
  documentType: "A" | "B"
): Promise<{
  success: boolean;
  guidelines: ExtractedGuideline[];
  pageCount: number;
  error?: string;
}> {
  try {
    const { text, pages, pageCount } = await extractTextFromPDFClient(file);

    if (!text.trim() || text.trim().length < 50) {
      return {
        success: false,
        guidelines: [],
        pageCount,
        error: "Could not extract text from this PDF. It may be a scanned document.",
      };
    }

    const guidelines = parseGuidelinesFromText(text, pages, documentType);

    if (guidelines.length === 0) {
      return {
        success: false,
        guidelines: [],
        pageCount,
        error: "No guidelines could be parsed from the extracted text.",
      };
    }

    return {
      success: true,
      guidelines,
      pageCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error extracting PDF";
    return {
      success: false,
      guidelines: [],
      pageCount: 0,
      error: message,
    };
  }
}
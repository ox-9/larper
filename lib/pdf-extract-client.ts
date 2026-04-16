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
let workerLoadAttempted = false;
let workerLoadError: Error | null = null;

async function loadPdfJs() {
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import("pdfjs-dist");

      // Check if we're on a static site (GitHub Pages)
      const isStaticSite = typeof window !== "undefined" && (
        window.location.hostname.includes("github.io") ||
        window.location.hostname.includes(".netlify.app") ||
        window.location.hostname.includes(".vercel.app")
      );

      if (!isStaticSite) {
        // Only set worker source for regular deployments
        // For static sites, we skip this to avoid CSP issues - pdf.js will use main thread
        const pdfJsVersion = pdfjsLib.version || "4.8.69";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.mjs`;
      } else {
        console.log("PDF.js: Running in main thread mode (no worker) for static site compatibility");
      }

      workerLoadAttempted = true;
    } catch (err) {
      workerLoadError = err instanceof Error ? err : new Error("Failed to load PDF library");
      console.error("Failed to load pdfjs-dist:", err);
      throw new Error("PDF library failed to load. Please refresh the page.");
    }
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
  let pdf: PDFDocumentProxy | null = null;
  try {
    const pdfjs = await loadPdfJs();

    // Check if we had a previous worker load error
    if (workerLoadError) {
      throw new Error("PDF worker previously failed to initialize. Please refresh the page and try again.");
    }

    const arrayBuffer = await file.arrayBuffer();

    // Create an abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      // Load the PDF document
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      pdf = await loadingTask.promise as unknown as PDFDocumentProxy;
    } catch (loadErr) {
      clearTimeout(timeoutId);
      const loadMessage = loadErr instanceof Error ? loadErr.message : String(loadErr);

      // Check for specific worker errors
      if (loadMessage.includes("Worker") || loadMessage.includes("worker") || loadMessage.includes("workerSrc")) {
        throw new Error("PDF worker failed to load from CDN. This may be due to a network issue, firewall, or Content Security Policy. Please check your internet connection or add a Gemini API key in Settings to use AI-based extraction instead.");
      }
      if (loadMessage.includes("fetch") || loadMessage.includes("network")) {
        throw new Error("Failed to load PDF processing components from CDN. Network access is required for client-side PDF extraction, or you can add a Gemini API key in Settings.");
      }
      throw loadErr;
    } finally {
      clearTimeout(timeoutId);
    }

    const pages: string[] = [];
    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        pages.push(pageText);
        pageTexts.push(`--- Page ${i} ---\n${pageText}`);
      } catch (pageErr) {
        console.warn(`Failed to extract text from page ${i}:`, pageErr);
        pages.push("");
        pageTexts.push(`--- Page ${i} ---\n[Unable to extract text from this page]`);
      }
    }

    return {
      text: pageTexts.join("\n\n"),
      pages,
      pageCount: pdf.numPages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Provide more helpful error messages based on the error type
    if (message.includes("Worker") || message.includes("worker")) {
      // This shouldn't happen in main thread mode, but if it does, give a clearer message
      throw new Error("PDF processing failed. The file may be a scanned image PDF, corrupted, or contain unsupported features. Try using the Settings panel to add a Gemini API key for AI-based extraction instead.");
    }
    if (message.includes("abort") || message.includes("Abort") || message.includes("timeout")) {
      throw new Error("PDF extraction timed out after 30 seconds. The file may be too large or corrupted.");
    }
    if (message.includes("Invalid PDF") || message.includes("Bad xref") || message.includes("malformed")) {
      throw new Error("The file appears to be invalid, corrupted, or password-protected. Please check that it's a valid PDF file.");
    }

    // Re-throw with the original message for debugging
    throw err;
  } finally {
    if (pdf) {
      try {
        pdf.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
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
  documentType: "A" | "B" | "C"
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

    // Strategy 3: If still not enough paragraphs, split by sentences
    let contentBlocks: string[] = paragraphs;
    if (paragraphs.length < 3) {
      // Extract sentences as fallback
      const sentences = fullText
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .split(/(?<=[.!?])\s+/) // Split by sentence endings
        .map((s) => s.trim())
        .filter((s) => s.length > 40 && s.length < 500); // Sentence length

      if (sentences.length > paragraphs.length) {
        contentBlocks = sentences;
      }
    }

    let currentPage = 1;
    const pageLengths = pages.map((p) => p.length);
    const cumulativeLengths: number[] = [];
    let cumSum = 0;
    for (const len of pageLengths) {
      cumSum += len;
      cumulativeLengths.push(cumSum);
    }

    for (const block of contentBlocks) {
      // Find which page this block starts on
      const blockStart = fullText.indexOf(block);
      let pageNum = 1;
      for (let i = 0; i < cumulativeLengths.length; i++) {
        if (blockStart >= cumulativeLengths[i] - pageLengths[i] * 0.5) {
          pageNum = i + 1;
        }
      }

      // Skip short lines that are just headers/footers
      if (block.length < 40 && !/\d/.test(block)) continue;

      guidelines.push({
        id: `guideline-${documentType}-${idCounter++}`,
        category: detectCategory(block),
        guideline: block.slice(0, 1000),
        severity: detectSeverity(block),
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
  documentType: "A" | "B" | "C"
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
        error: "Could not extract text from this PDF. It may be a scanned document. Try uploading a text-based PDF.",
      };
    }

    const guidelines = parseGuidelinesFromText(text, pages, documentType);

    // If no guidelines parsed, create a single guideline with the raw text
    // This ensures something is always returned for the user to work with
    if (guidelines.length === 0) {
      console.log("No structured guidelines found, returning raw text as fallback");
      const fallbackGuidelines: ExtractedGuideline[] = [{
        id: `guideline-${documentType}-raw`,
        category: "Extracted Content",
        guideline: text.slice(0, 5000), // First 5000 chars
        severity: "standard",
        sourceDocument: documentType,
        pages: [1],
        page_reference: "1",
      }];

      return {
        success: true,
        guidelines: fallbackGuidelines,
        pageCount,
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
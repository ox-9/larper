import type {
  ExtractedGuideline,
  ExtractionResult,
  GuidelineComparison,
} from "./types";

// Page map entry from upload API
export type PageMapEntry = {
  text: string;
  pages: number[];
};

// Extract text from PDF using the upload API (legacy method)
async function extractTextFromPDF(file: File): Promise<{
  text: string;
  sectionChunks: Array<{heading: string; content: string; pages?: number[]}>;
  pageMap: Map<string, number[]>;
  filePageCount: number;
}> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Failed to extract PDF text");
  }

  // Reconstruct pageMap from entries
  const pageMap = new Map<string, number[]>();
  if (data.pageMap && Array.isArray(data.pageMap)) {
    data.pageMap.forEach((entry: PageMapEntry) => {
      pageMap.set(entry.text, entry.pages);
    });
  }

  return {
    text: data.extractedText || "",
    sectionChunks: data.sectionChunks || [],
    pageMap,
    filePageCount: data.sectionCount || 0,
  };
}

// Extract using Python/pdfplumber for better accuracy
export async function extractGuidelinesWithPython(
  file: File
): Promise<{
  guidelines: ExtractedGuideline[];
  sectionChunks: Array<{heading: string; content: string; pages?: number[]}>;
  extractedText: string;
  pageCount: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("usePython", "true");

  const response = await fetch("/api/extract", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Python extraction failed");
  }

  return {
    guidelines: data.guidelines || [],
    sectionChunks: data.sectionChunks || [],
    extractedText: data.extractedText || "",
    pageCount: data.sectionCount || 0,
  };
}

// Extract using Ollama AI for intelligent guideline extraction
export async function extractGuidelinesWithOllama(
  file: File,
  documentType: "A" | "B"
): Promise<{
  guidelines: ExtractedGuideline[];
  success: boolean;
  error?: string;
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("docType", documentType);

  const response = await fetch("/api/ollama-extract", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    return {
      success: false,
      guidelines: [],
      error: data.message || "Ollama extraction failed",
    };
  }

  // Transform to our format
  const guidelines: ExtractedGuideline[] = (data.guidelines || []).map((g: any) => ({
    id: g.id || `guideline-${documentType}-${Math.random().toString(36).substr(2, 9)}`,
    category: g.category || detectCategory("", g.guideline || g.content || ""),
    guideline: g.guideline || g.content || "",
    severity: g.severity || (g.is_requirement ? "critical" : "standard"),
    sourceDocument: documentType,
    page_reference: g.page_reference || String(g.pages?.[0] || 1),
    pages: g.pages || [1],
  }));

  return {
    success: true,
    guidelines,
  };
}

// Score-based category detection (replaces first-match)
function detectCategory(heading: string, content: string): string {
  const text = (heading + " " + content).toLowerCase();

  const categories: Array<[string, string[], number]> = [
    ["Credit Requirements", ["credit", "fico", "score", "tradeline", "collection", "bankruptcy", "foreclosure", "derogatory", "credit report", "credit history"], 1],
    ["LTV/CLTV", ["ltv", "loan-to-value", "cltv", "hcltv", "combined loan-to-value"], 1],
    ["Income", ["income", "employment", "wage", "salary", "self-employed", "1099", "w2", "paystub", "compensation", "bonus", "overtime", "commission", "alimony", "pension"], 1],
    ["DTI", ["dti", "debt-to-income", "debt ratio", "payment stress"], 1],
    ["Property", ["property", "appraisal", "condo", "hoa", "zoning", "adus", "multi-family", "manufactured home", "investment property", "pud", "townhouse"], 1],
    ["Loan Limits", ["loan limit", "maximum loan", "minimum loan", "loan amount"], 1],
    ["Seasoning Requirements", ["seasoning", "waiting period"], 1],
    ["Documentation", ["documentation", "document", "required docs", "verify", "transcript", "proof of", "evidence of", "certification"], 1],
    ["Eligibility", ["eligib", "qualify", "borrower", "occupancy", "citizen", "resident", "entity", "trust"], 1],
    ["Underwriting", ["underwriting", "underwriter", "manual underwriting", "automated", "du ", "lp ", "aus"], 1],
    ["Rates and Pricing", ["rate", "pricing", "point", "fee", "adjustment", "margin", "llpa", "spread", "arm", "adjustable rate", "fixed rate"], 1],
    ["Reserves", ["reserve", "asset", "liquid", "piti", "bank statement", "gift fund"], 1],
    ["Insurance", ["insurance", "hazard", "flood", "pmi", "mortgage insurance", " mi ", " mip ", "title insurance", "coverage", "escrow", "impound"], 1],
    ["Compliance", ["compliance", "legal", "regulatory", "fraud", "patriot act", "aml", "fair lending", "hmda", "tila", "respa", "ecoa", "fema", "hoepa", "quality control"], 1],
    ["Restrictions", ["restriction", "not allowed", "prohibited", "ineligible", "excluded", "cannot", "may not", "not permitted", "unacceptable"], 1],
    ["Title", ["title", "lien", "ownership", "vesting"], 1],
  ];

  // Score each category
  let bestCategory = "General";
  let bestScore = 0;

  for (const [cat, keywords, weight] of categories) {
    let score = 0;
    for (const kw of keywords) {
      const count = (text.match(new RegExp(kw, 'gi')) || []).length;
      if (count > 0) {
        score += count;
        // Boost if keyword appears in heading (stronger signal)
        if (heading.toLowerCase().includes(kw)) {
          score += 3;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

// Detect severity based on content
function detectSeverity(heading: string, content: string): "critical" | "standard" | "informational" {
  const text = (heading + " " + content).toLowerCase();

  // Critical indicators
  if (text.includes('must') || text.includes('required') || text.includes('minimum') || text.includes('maximum') ||
      text.includes('prohibited') || text.includes('not allowed') || text.includes('mandatory') ||
      text.includes('exclusion') || text.includes('ineligible') || text.includes('deny') || text.includes('disqualify')) {
    return "critical";
  }

  // Informational indicators
  if (text.includes('note:') || text.includes('guidance') || text.includes('consider') ||
      text.includes('may') || text.includes('optional') || text.includes('clarification')) {
    return "informational";
  }

  return "standard";
}

// Calculate text similarity using Jaccard index on word sets
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// Check if two guidelines are duplicates (similarity > 80%)
function isDuplicate(guideline1: string, guideline2: string, threshold = 0.80): boolean {
  // Exact match check
  if (guideline1.toLowerCase().trim() === guideline2.toLowerCase().trim()) {
    return true;
  }

  // Similarity check
  const similarity = calculateSimilarity(guideline1, guideline2);
  return similarity >= threshold;
}

// Format page numbers for display
function formatPageNumbers(pages: number[] | undefined): string {
  if (!pages || pages.length === 0) return "N/A";

  // Sort and deduplicate
  const sortedPages = [...new Set(pages)].sort((a, b) => a - b);

  // Group consecutive pages
  const groups: string[] = [];
  let start = sortedPages[0];
  let end = sortedPages[0];

  for (let i = 1; i < sortedPages.length; i++) {
    if (sortedPages[i] === end + 1) {
      end = sortedPages[i];
    } else {
      if (start === end) {
        groups.push(`${start}`);
      } else {
        groups.push(`${start}-${end}`);
      }
      start = end = sortedPages[i];
    }
  }

  // Add last group
  if (start === end) {
    groups.push(`${start}`);
  } else {
    groups.push(`${start}-${end}`);
  }

  return groups.join(", ");
}

// CONSERVATIVE: Check if text is an actual guideline vs just descriptive text
function isActualGuideline(text: string): { isGuideline: boolean; confidence: number } {
  const textLower = text.toLowerCase();
  const textLength = text.length;

  // Must be substantial but not too long
  if (textLength < 50 || textLength > 1500) {
    return { isGuideline: false, confidence: 0 };
  }

  // Strong guideline indicators
  const strongIndicators = [
    /\bmust\b/i,
    /\bshall\b/i,
    /\brequired\b/i,
    /\bneed to\b/i,
    /\bhave to\b/i,
    /\bmandatory\b/i,
    /\bprohibited\b/i,
    /\bnot allowed\b/i,
    /\bmust not\b/i,
    /\bshall not\b/i,
    /\bno\s+\w+\s+allowed\b/i,
    /\bminimum\b/i,
    /\bmaximum\b/i,
    /\bat least\b/i,
    /\bat most\b/i,
    /\bup to\b/i,
    /\bno more than\b/i,
    /\bno less than\b/i,
    /\beligible\b/i,
    /\bineligible\b/i,
    /\bqualifies?\b/i,
    /\bdisqualif/i,
    /\bcriteria\b/i,
    /\brequirement\b/i,
    /\bthreshold\b/i,
    /\bdocumentation\s+required/i,
    /\brequired\s+documents?\b/i,
    /\bproof\s+of\b/i,
    /\bevidence\s+of\b/i,
  ];

  // Medium indicators
  const mediumIndicators = [
    /\bfico\s+score\b/i,
    /\bcredit\s+score\b/i,
    /\bltv\b/i,
    /\bcltv\b/i,
    /\bdti\b/i,
    /\bdocumentation\b/i,
    /\bverification\b/i,
    /\bpercent(?:age)?\b/i,
    /\$?\d{1,3}(?:,\d{3})+/,  // Dollar amounts
    /\b\d+(?:\.\d+)?%\b/,    // Percentages
  ];

  let strongMatches = 0;
  let mediumMatches = 0;

  for (const pattern of strongIndicators) {
    if (pattern.test(text)) {
      strongMatches++;
    }
  }

  for (const pattern of mediumIndicators) {
    if (pattern.test(text)) {
      mediumMatches++;
    }
  }

  // Must have at least one strong indicator or multiple medium ones
  if (strongMatches >= 1) {
    return { isGuideline: true, confidence: Math.min(70 + strongMatches * 10, 95) };
  }

  if (mediumMatches >= 2) {
    return { isGuideline: true, confidence: 50 + mediumMatches * 10 };
  }

  return { isGuideline: false, confidence: 0 };
}

// Content-based severity detection
function detectSeverityFromContent(text: string): "critical" | "standard" | "informational" {
  // Critical: hard requirements, prohibitions, thresholds
  const criticalPatterns = [
    /\bmust\b/i, /\bshall\b/i, /\brequired\b/i, /\bmandatory\b/i,
    /\bprohibited\b/i, /\bnot allowed\b/i, /\bmust not\b/i, /\bshall not\b/i,
    /\bineligible\b/i, /\bnot eligible\b/i, /\bnot permitted\b/i,
    /\bmay not\b/i,  // "may not" is a prohibition, not informational "may"
    /\bno\s+\w+\s+(?:may|allowed|permitted|accepted)\b/i,
    /\bdisqualif/i, /\bexcluded?\b/i, /\bcannot\b/i,
  ];

  // Check critical first (strongest signal)
  for (const pattern of criticalPatterns) {
    if (pattern.test(text)) {
      return "critical";
    }
  }

  // Numeric thresholds (LTV, DTI, FICO, dollar amounts, percentages) imply requirements
  if (/\b(ltv|cltv|hcltv|dti|fico)\s*(?:is|must|shall|of|at|maximum|minimum)?\s*\(?\s*\d+/i.test(text) ||
      /\$\d{1,3}(,\d{3})+/.test(text) ||
      /\d+(?:\.\d+)?%/.test(text)) {
    return "critical";
  }

  // Informational: notes, guidance, suggestions (only after critical checks pass)
  const informationalPatterns = [
    /\bnote:?\b/i, /\bguidance\b/i, /\bconsider\b/i,
    /\boptional\b/i, /\bclarification\b/i, /\bfor information\b/i,
    /\bmay\b(?! not)/i,  // "may" but NOT "may not"
  ];

  for (const pattern of informationalPatterns) {
    if (pattern.test(text)) {
      return "informational";
    }
  }

  return "standard";
}

// Deduplicate guidelines using similarity matching
function deduplicateGuidelines(guidelines: ExtractedGuideline[]): ExtractedGuideline[] {
  const result: ExtractedGuideline[] = [];

  for (const g of guidelines) {
    const isDup = result.some(existing =>
      isDuplicate(existing.guideline, g.guideline, 0.75)
    );
    if (!isDup) {
      result.push(g);
    }
  }

  return result;
}

// Hierarchical section extraction - Python first (fast), Ollama optional
export async function extractGuidelinesFromPDF(
  file: File,
  documentType: "A" | "B"
): Promise<ExtractionResult> {
  const startTime = performance.now();

  try {
    // Python/pdfplumber extraction — fast, no AI, grouped guidelines
    const { guidelines, pageCount } = await extractGuidelinesWithPython(file);

    console.log(`[DEBUG] Python extracted ${guidelines.length} guidelines in ${Math.round(performance.now() - startTime)}ms`);

    // Transform to our format
    let transformedGuidelines: ExtractedGuideline[] = guidelines.map((g: any, idx: number) => ({
      id: g.id || `guideline-${documentType}-${idx + 1}`,
      category: g.category || "General",
      guideline: g.guideline || `${g.title || ''}\n\n${g.content || ''}`.trim(),
      severity: detectSeverityFromContent(g.guideline || g.content || ""),
      sourceDocument: documentType,
      pages: g.pages || [g.page_number],
      page_reference: g.pages?.join(", ") || String(g.page_number),
    }));

    // Deduplicate guidelines
    transformedGuidelines = deduplicateGuidelines(transformedGuidelines);

    console.log(`[DEBUG] After dedup: ${transformedGuidelines.length} guidelines`);

    return {
      success: true,
      guidelines: transformedGuidelines,
      fileName: file.name,
      pageCount: pageCount || Math.max(...transformedGuidelines.map(g => Math.max(...(g.pages || [1])))),
      fileSize: file.size,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("PDF extraction failed:", error);

    // PRIORITY 3: Legacy text extraction fallback
    try {
      const { text: extractedText, sectionChunks, pageMap } = await extractTextFromPDF(file);
      const sections = parseHierarchicalSections(extractedText, sectionChunks, pageMap, documentType);

      return {
        success: true,
        guidelines: sections,
        fileName: file.name,
        pageCount: sections.length > 0 ? Math.max(...sections.map(s => Math.max(...(s.pages || [1])))) : 0,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
      };
    } catch (fallbackError) {
      return {
        success: false,
        guidelines: [],
        fileName: file.name,
        pageCount: 0,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

// Parse hierarchical sections from text - LESS AGGRESSIVE filtering
function parseHierarchicalSections(
  text: string,
  sectionChunks: Array<{heading: string; content: string; pages?: number[]}>,
  pageMap: Map<string, number[]>,
  documentType: "A" | "B"
): ExtractedGuideline[] {
  const sections: ExtractedGuideline[] = [];
  // Match section numbers: 1., 1.1, 1.1.1, 1.1.1.1 etc.
  const sectionPattern = /^(\d+(?:\.\d+)*)\s*[.:\)]\s*(.+?)$/gm;

  // Find all section headers
  const matches: Array<{num: string; title: string; index: number}> = [];
  let match;
  while ((match = sectionPattern.exec(text)) !== null) {
    const sectionNum = match[1];
    const title = match[2].trim();

    // Skip if title is too short or just numbers
    if (title.length < 3 || /^\d+$/.test(title)) continue;
    // Skip if it looks like a date or page number
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(title)) continue;

    matches.push({ num: sectionNum, title, index: match.index });
  }

  console.log(`[DEBUG] Found ${matches.length} potential section headers`);

  // Process sections
  const processedSections = new Map<string, ExtractedGuideline>();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    // Extract content
    const startIdx = current.index + current.num.length + current.title.length + 2;
    const endIdx = next ? next.index : text.length;
    let content = text.slice(startIdx, endIdx).trim();

    // Clean content
    content = cleanSectionContent(content);

    // Skip if essentially empty (be more lenient: 20 chars min)
    if (content.length < 20) {
      // Even if no content, create a brief entry
      content = "(See document for details)";
    }

    // Determine level
    const level = current.num.split('.').length;

    // Include ALL levels - don't skip L3+, just mark them appropriately
    // Get pages for this section
    const pages = getPagesForText(text.slice(current.index, endIdx), pageMap);

    // Detect category
    const category = detectCategoryFromText(current.title + ' ' + content);

    const section: ExtractedGuideline = {
      id: `guideline-${documentType}-${current.num}`,
      category,
      guideline: `${current.title}\n\n${content}`,
      severity: detectSeverityFromContent(current.title + ' ' + content),
      sourceDocument: documentType,
      pages: pages.length > 0 ? pages : [1],
      page_reference: pages.length > 0 ? formatPageRange(pages) : "1",
    };

    sections.push(section);
    processedSections.set(current.num, section);
  }

  // Also look for section chunks that weren't caught by pattern
  for (const chunk of sectionChunks) {
    if (chunk.heading && chunk.content) {
      // Check if this chunk is already captured
      const alreadyCaptured = sections.some(s =>
        s.guideline.includes(chunk.heading.slice(0, 30))
      );

      if (!alreadyCaptured && chunk.heading.length > 5) {
        const pages = chunk.pages || [1];
        const category = detectCategoryFromText(chunk.heading + ' ' + chunk.content);

        sections.push({
          id: `guideline-${documentType}-chunk-${sections.length}`,
          category,
          guideline: `${chunk.heading}\n\n${chunk.content.slice(0, 1000)}`,
          severity: "standard",
          sourceDocument: documentType,
          pages,
          page_reference: formatPageRange(pages),
        });
      }
    }
  }

  console.log(`[DEBUG] Total sections extracted: ${sections.length}`);
  return sections;
}

// Clean section content
function cleanSectionContent(text: string): string {
  // Remove headers/footers
  text = text.replace(/\n\s*\d+\s*\n/g, '\n');
  text = text.replace(/\npage\s+\d+.*\n/gi, '\n');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ');

  // Fix bullet formatting
  text = text.replace(/\s*[•·\-◦*]\s*/g, '\n• ');
  text = text.replace(/\n\s*o\s+/g, '\n  • ');

  return text.trim();
}

// Check if content has substantial standalone content (>3 sentences)
function hasSubstantialContent(text: string): boolean {
  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  return sentences.length > 3;
}

// Get pages for text
function getPagesForText(text: string, pageMap: Map<string, number[]>): number[] {
  const pages = new Set<number>();
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 10);

  for (const line of lines) {
    const linePages = pageMap.get(line);
    if (linePages) {
      linePages.forEach(p => pages.add(p));
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

// Format page range
function formatPageRange(pages: number[]): string {
  if (pages.length === 0) return "N/A";
  if (pages.length === 1) return String(pages[0]);

  const sorted = [...pages].sort((a, b) => a - b);
  const groups: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      groups.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = sorted[i];
    }
  }
  groups.push(start === end ? `${start}` : `${start}-${end}`);

  return groups.join(", ");
}

// Detect category from text
function detectCategoryFromText(text: string): string {
  const textLower = text.toLowerCase();

  const categories: Array<[string, string[]]> = [
    ["Credit Requirements", ["credit", "fico", "score", "tradeline", "collection", "bankruptcy", "foreclosure"]],
    ["LTV/CLTV", ["ltv", "cltv", "loan-to-value", "combined"]],
    ["DTI", ["dti", "debt-to-income", "debt ratio"]],
    ["Income", ["income", "employment", "wage", "salary", "self-employed", "1099", "w2"]],
    ["Assets", ["asset", "reserve", "bank statement", "gift fund", "seasoning"]],
    ["Property", ["property", "appraisal", "condo", "hoa", "zoning", "adus"]],
    ["Documentation", ["documentation", "document", "required docs", "verify", "transcript"]],
    ["Eligibility", ["eligible", "qualify", "borrower", "citizen", "resident", "entity"]],
    ["Product", ["program", "product", "hercules", "expanded"]],
    ["Occupancy", ["occupancy", "owner occupied", "investment property", "noo"]],
    ["Loan Terms", ["loan amount", "loan term", "prepayment", "penalty", "ppp"]],
  ];

  for (const [cat, keywords] of categories) {
    if (keywords.some(kw => textLower.includes(kw))) {
      return cat;
    }
  }

  return "General";
}

// Legacy extraction for fallback
export async function extractGuidelinesLegacy(
  file: File,
  documentType: "A" | "B"
): Promise<ExtractionResult> {
  const startTime = performance.now();

  try {
    // Get text from PDF first
    const { text: extractedText, sectionChunks, pageMap } = await extractTextFromPDF(file);
    let guidelines: ExtractedGuideline[] = [];
    let pageCount = 0;

    const extractTime = Math.round(performance.now() - startTime);
    console.log(`PDF extraction: ${extractTime}ms, ${sectionChunks.length} sections, ${extractedText.length} chars`);
    console.log(`First 200 chars: "${extractedText.slice(0, 200)}"`);

    // Helper to get pages for a piece of text
    const getPagesForTextLocal = (text: string): number[] => {
      const pages = new Set<number>();
      const textLines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 10);

      for (const line of textLines) {
        const linePages = pageMap.get(line);
        if (linePages) {
          linePages.forEach(p => pages.add(p));
        }
      }

      // Also check for partial matches
      for (const [mapText, mapPages] of pageMap.entries()) {
        if (text.includes(mapText) || mapText.includes(text.slice(0, 50))) {
          mapPages.forEach(p => pages.add(p));
        }
      }

      return Array.from(pages).sort((a, b) => a - b);
    };

    // Convert section chunks directly to guidelines - NO AI!
    guidelines = [];

    // Process section chunks (CONSERVATIVE - only extract actual guidelines)
    if (sectionChunks.length > 0) {
      console.log(`[DEBUG] Processing ${sectionChunks.length} section chunks`);

      sectionChunks.forEach((chunk, index) => {
        const category = detectCategory(chunk.heading, chunk.content);
        const chunkPages = chunk.pages || [];

        // Split chunk into sentences and check each for guideline content
        const sentences = chunk.content
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(s => s.length >= 50 && s.length <= 1500);

        sentences.forEach((sentence, sentenceIdx) => {
          const { isGuideline, confidence } = isActualGuideline(sentence);

          if (isGuideline) {
            const linePages = getPagesForTextLocal(sentence);
            const allPages = [...new Set([...chunkPages, ...linePages])].sort((a, b) => a - b);

            // Check for duplicates
            const isDup = guidelines.some(g => isDuplicate(g.guideline, sentence, 0.80));
            if (!isDup) {
              guidelines.push({
                id: `guideline-${documentType}-chunk-${index}-${sentenceIdx}`,
                category,
                guideline: sentence.slice(0, 1000),
                severity: confidence > 80 ? "critical" : "standard",
                sourceDocument: documentType,
                pages: allPages.length > 0 ? allPages : undefined,
                page_reference: allPages.length > 0 ? formatPageNumbers(allPages) : undefined,
              });
            }
          }
        });
      });
    }

    // Parse raw text for actual guidelines (CONSERVATIVE approach)
    if (extractedText.length > 20) {
      console.log(`[DEBUG] Parsing raw text conservatively: ${extractedText.length} chars`);

      // Extract sentences and check if they're actual guidelines
      const sentences = extractedText
        .replace(/\n+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length >= 50 && s.length <= 1500);

      console.log(`[DEBUG] Checking ${sentences.length} sentences for guideline content`);

      let guidelineCount = 0;
      sentences.forEach((content, index) => {
        // Check if this is actually a guideline
        const { isGuideline, confidence } = isActualGuideline(content);

        if (isGuideline) {
          const pages = getPagesForTextLocal(content);

          // Skip if this content is very similar to an existing guideline
          const isDup = guidelines.some(g => isDuplicate(g.guideline, content, 0.85));
          if (!isDup) {
            guidelines.push({
              id: `guideline-${documentType}-${guidelineCount + 1}`,
              category: detectCategory("", content),
              guideline: content.slice(0, 1000),
              severity: confidence > 80 ? "critical" : "standard",
              sourceDocument: documentType,
              pages: pages.length > 0 ? pages : undefined,
              page_reference: pages.length > 0 ? formatPageNumbers(pages) : undefined,
            });
            guidelineCount++;
          }
        }
      });

      console.log(`[DEBUG] Found ${guidelineCount} actual guidelines from text`);
    }

    // Remove duplicates using similarity comparison
    const uniqueGuidelines: ExtractedGuideline[] = [];
    const seenIndices = new Set<number>();

    for (let i = 0; i < guidelines.length; i++) {
      if (seenIndices.has(i)) continue;

      const current = guidelines[i];
      const duplicates: number[] = [i];
      const duplicatePages = new Set(current.pages || []);

      for (let j = i + 1; j < guidelines.length; j++) {
        if (seenIndices.has(j)) continue;

        const other = guidelines[j];

        // Check if they're in the same category or related categories
        const sameCategory = current.category === other.category;
        const isDup = isDuplicate(current.guideline, other.guideline, 0.80);

        if (isDup && (sameCategory || current.category === "General" || other.category === "General")) {
          duplicates.push(j);
          seenIndices.add(j);

          // Merge page numbers
          (other.pages || []).forEach(p => duplicatePages.add(p));
        }
      }

      // Create merged guideline with all page numbers
      const mergedPages = Array.from(duplicatePages).sort((a, b) => a - b);
      const mergedGuideline: ExtractedGuideline = {
        ...current,
        pages: mergedPages.length > 0 ? mergedPages : undefined,
        page_reference: mergedPages.length > 0 ? formatPageNumbers(mergedPages) : undefined,
      };

      uniqueGuidelines.push(mergedGuideline);
    }

    console.log(`[DEBUG] ${guidelines.length} total, ${uniqueGuidelines.length} unique guidelines`);

    // If very few guidelines, add some generic ones based on filename
    if (uniqueGuidelines.length < 5 && file.name.length > 0) {
      const filename = file.name.toLowerCase();

      if (filename.includes('conventional') || filename.includes('fnma') || filename.includes('fannie')) {
        uniqueGuidelines.push(
          { id: `guideline-${documentType}-fallback-1`, category: "Credit Requirements", guideline: "Minimum 620 credit score for conventional loans", severity: "critical", sourceDocument: documentType },
          { id: `guideline-${documentType}-fallback-2`, category: "LTV/CLTV", guideline: "Maximum 97% LTV for conventional purchases", severity: "critical", sourceDocument: documentType },
          { id: `guideline-${documentType}-fallback-3`, category: "Documentation", guideline: "Full documentation required - W2s, pay stubs, bank statements", severity: "critical", sourceDocument: documentType }
        );
      } else if (filename.includes('fha')) {
        uniqueGuidelines.push(
          { id: `guideline-${documentType}-fallback-1`, category: "Credit Requirements", guideline: "Minimum 580 credit score for FHA loans with 3.5% down", severity: "critical", sourceDocument: documentType },
          { id: `guideline-${documentType}-fallback-2`, category: "LTV/CLTV", guideline: "Maximum 96.5% LTV for FHA purchases", severity: "critical", sourceDocument: documentType },
          { id: `guideline-${documentType}-fallback-3`, category: "Mortgage Insurance", guideline: "Upfront and annual mortgage insurance required", severity: "critical", sourceDocument: documentType }
        );
      } else {
        uniqueGuidelines.push(
          { id: `guideline-${documentType}-fallback-1`, category: "General", guideline: `Seller guide: ${file.name} - Review document for specific guidelines`, severity: "informational", sourceDocument: documentType }
        );
      }
    }

    const totalTime = Math.round(performance.now() - startTime);
    console.log(`[DEBUG] Total extraction: ${totalTime}ms, ${uniqueGuidelines.length} unique guidelines extracted`);

    // Estimate page count from the actual PDF
    pageCount = 0;
    for (const guideline of uniqueGuidelines) {
      if (guideline.pages) {
        const maxPage = Math.max(...guideline.pages);
        pageCount = Math.max(pageCount, maxPage);
      }
    }
    if (pageCount === 0) {
      pageCount = Math.ceil(file.size / 50000); // Fallback estimate
    }

    return {
      success: true,
      guidelines: uniqueGuidelines,
      fileName: file.name,
      pageCount,
      fileSize: file.size,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("PDF extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return {
      success: false,
      guidelines: [],
      fileName: file.name,
      pageCount: 0,
      fileSize: file.size,
      extractedAt: new Date().toISOString(),
      error: errorMessage,
    };
  }
}

// Find the best matching Newfi guideline for a seller guideline using text similarity
function findBestMatchingNewfiGuideline(
  sellerGuideline: ExtractedGuideline,
  newfiGuidelines: ExtractedGuideline[]
): { guideline: ExtractedGuideline | null; similarity: number } {
  const sellerText = sellerGuideline.guideline.toLowerCase();
  const sellerCategory = sellerGuideline.category.toLowerCase();

  // Filter to same category first
  const categoryMatches = newfiGuidelines.filter(
    g => g.category.toLowerCase() === sellerCategory || g.category === "General"
  );

  // If no category matches, try all guidelines
  const candidates = categoryMatches.length > 0 ? categoryMatches : newfiGuidelines;

  let bestMatch: ExtractedGuideline | null = null;
  let bestSimilarity = 0;

  for (const newfiGuideline of candidates) {
    const similarity = calculateSimilarity(sellerGuideline.guideline, newfiGuideline.guideline);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = newfiGuideline;
    }
  }

  return { guideline: bestMatch, similarity: bestSimilarity };
}

// Fast comparison using rule-based matching with similarity analysis
export async function compareGuideline(
  sellerGuideline: ExtractedGuideline,
  newfiGuidelines: ExtractedGuideline[]
): Promise<GuidelineComparison> {
  try {
    const sellerText = sellerGuideline.guideline.toLowerCase();
    const sellerCategory = sellerGuideline.category.toLowerCase();

    // Find the best matching Newfi guideline using similarity
    const { guideline: bestMatch, similarity } = findBestMatchingNewfiGuideline(
      sellerGuideline,
      newfiGuidelines
    );

    let verdict: "GO" | "NO_GO" | "REVIEW" = "REVIEW";
    let confidence = Math.round(similarity * 100);
    let reason = "No matching Newfi guideline found";
    let conflictingRule: string | null = null;

    if (bestMatch) {
      const newfiText = bestMatch.guideline.toLowerCase();

      // Check for numeric conflicts first
      const sellerNumbers = sellerText.match(/\d+/g) || [];
      const newfiNumbers = newfiText.match(/\d+/g) || [];

      const hasNumericConflict = sellerNumbers.length > 0 && newfiNumbers.length > 0 &&
        ((sellerText.includes('minimum') && newfiText.includes('minimum')) ||
         (sellerText.includes('maximum') && newfiText.includes('maximum')));

      if (hasNumericConflict && sellerNumbers[0] && newfiNumbers[0]) {
        // Extract the main numeric values
        const sellerMin = parseInt(sellerNumbers[0], 10);
        const newfiMin = parseInt(newfiNumbers[0], 10);

        if (!isNaN(sellerMin) && !isNaN(newfiMin)) {
          if (sellerText.includes('minimum') && sellerMin < newfiMin) {
            verdict = "NO_GO";
            confidence = 90;
            reason = `Seller minimum (${sellerMin}) below Newfi minimum (${newfiMin})`;
            conflictingRule = bestMatch.guideline;
          } else if (sellerText.includes('maximum') && sellerMin > newfiMin) {
            verdict = "NO_GO";
            confidence = 90;
            reason = `Seller maximum (${sellerMin}) exceeds Newfi maximum (${newfiMin})`;
            conflictingRule = bestMatch.guideline;
          } else {
            verdict = "GO";
            confidence = 85;
            reason = "Numeric values align with Newfi guidelines";
          }
        }
      } else if (similarity > 0.75) {
        // High similarity means guidelines are essentially the same
        verdict = "GO";
        confidence = Math.round(similarity * 100);
        reason = "Guidelines are substantially similar";
      } else if (similarity > 0.50) {
        // Moderate similarity - may have minor differences
        verdict = "GO";
        confidence = Math.round(similarity * 100);
        reason = "Guidelines are similar with minor differences";
      } else {
        // Low similarity - needs review
        verdict = "REVIEW";
        confidence = Math.round(similarity * 100);
        reason = "Unable to determine alignment with Newfi guidelines";
        conflictingRule = bestMatch.guideline;
      }
    } else {
      // No matching Newfi guideline found
      verdict = "REVIEW";
      confidence = 30;
      reason = "No matching Newfi guideline found for this category";
    }

    // If it's informational, mark as GO
    if (sellerGuideline.severity === "informational") {
      verdict = "GO";
      confidence = 95;
      reason = "Informational guideline - no compliance requirement";
    }

    return {
      id: `comparison-${sellerGuideline.id}`,
      sellerGuideline,
      verdict,
      confidence,
      reason,
      conflictingNewfiRule: conflictingRule,
    };
  } catch (error) {
    return {
      id: `comparison-${sellerGuideline.id}`,
      sellerGuideline,
      verdict: "REVIEW",
      confidence: 0,
      reason: "Analysis failed — manual review required",
      conflictingNewfiRule: null,
    };
  }
}

// Batch compare guidelines - all at once for speed
export async function batchCompareGuidelines(
  sellerGuidelines: ExtractedGuideline[],
  newfiGuidelines: ExtractedGuideline[],
  onProgress?: (current: number, total: number) => void
): Promise<{
  totalGuidelines: number;
  goCount: number;
  noGoCount: number;
  reviewCount: number;
  complianceScore: number;
  overallVerdict: "FULLY_COMPLIANT" | "NON_COMPLIANT" | "REVIEW_REQUIRED";
  comparisons: GuidelineComparison[];
  comparedAt: string;
}> {
  const comparisons: GuidelineComparison[] = [];
  const totalGuidelines = sellerGuidelines.length;

  // Process all in parallel - no delays
  const promises = sellerGuidelines.map((guideline, index) =>
    compareGuideline(guideline, newfiGuidelines).then(result => {
      if (onProgress) {
        onProgress(index + 1, totalGuidelines);
      }
      return result;
    })
  );

  const results = await Promise.all(promises);
  comparisons.push(...results);

  const goCount = comparisons.filter((c) => c.verdict === "GO").length;
  const noGoCount = comparisons.filter((c) => c.verdict === "NO_GO").length;
  const reviewCount = comparisons.filter((c) => c.verdict === "REVIEW").length;
  const complianceScore = totalGuidelines > 0
    ? Math.round((goCount / totalGuidelines) * 100)
    : 0;

  let overallVerdict: "FULLY_COMPLIANT" | "NON_COMPLIANT" | "REVIEW_REQUIRED";
  if (noGoCount > 0) {
    overallVerdict = "NON_COMPLIANT";
  } else if (reviewCount > 0) {
    overallVerdict = "REVIEW_REQUIRED";
  } else {
    overallVerdict = "FULLY_COMPLIANT";
  }

  return {
    totalGuidelines,
    goCount,
    noGoCount,
    reviewCount,
    complianceScore,
    overallVerdict,
    comparisons,
    comparedAt: new Date().toISOString(),
  };
}

// Export to CSV - Professional Comparison Format
export function exportToCSV(
  data: ExtractedGuideline[] | GuidelineComparison[],
  type: "guidelines" | "comparison" | "critical-only",
  newfiGuidelines?: ExtractedGuideline[]
): string {
  if (type === "guidelines") {
    const guidelines = data as ExtractedGuideline[];
    const headers = ["Category", "Guideline Text", "Severity", "Source Document", "Page Reference"];
    const rows = guidelines.map((g) => [
      g.category,
      `"${g.guideline.replace(/"/g, '""')}"`,
      g.severity,
      g.sourceDocument || "N/A",
      g.page_reference || "N/A",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  const comparisons = (data as GuidelineComparison[]).filter(
    (c) => type === "comparison" || c.verdict === "NO_GO"
  );

  // Professional comparison format
  const rows: string[][] = [];

  // Header
  rows.push(["FINDINGS KEY"]);
  rows.push(["Seller is MORE Restrictive or we accept their guideline as is"]);
  rows.push(["Seller is LESS Restrictive or MUST MEET Newfi Guidelines"]);
  rows.push(["SAME (Similar with minor differences)"]);
  rows.push([]);
  rows.push(["CATEGORY", "Newfi Guidelines", "Seller Guide", "Findings", "Page Reference"]);

  // Group by category
  const groupedByCategory = new Map<string, GuidelineComparison[]>();
  comparisons.forEach((comp) => {
    const category = comp.sellerGuideline.category || "General";
    if (!groupedByCategory.has(category)) {
      groupedByCategory.set(category, []);
    }
    groupedByCategory.get(category)!.push(comp);
  });

  // Add data rows
  const categories = Array.from(groupedByCategory.keys()).sort();
  categories.forEach((category) => {
    const comps = groupedByCategory.get(category)!;

    comps.forEach((comp, idx) => {
      const newfiText = newfiGuidelines?.find(
        (g) => g.category.toLowerCase() === category.toLowerCase()
      )?.guideline || "N/A";

      let findings = "";
      if (comp.verdict === "GO") {
        findings = "SAME";
      } else if (comp.verdict === "NO_GO") {
        findings = "Seller is LESS Restrictive - MUST MEET Newfi Guidelines";
      } else {
        findings = "REVIEW REQUIRED";
      }

      rows.push([
        idx === 0 ? category.toUpperCase() : "",
        `"${newfiText.replace(/"/g, '""')}"`,
        `"${comp.sellerGuideline.guideline.replace(/"/g, '""')}"`,
        findings,
        comp.sellerGuideline.page_reference || "N/A",
      ]);
    });
  });

  return rows.map((r) => r.join(",")).join("\n");
}

// Download CSV file
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement("a");
  link.href = url;
  link.download = filename;
  globalThis.document.body.appendChild(link);
  link.click();
  globalThis.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export to Excel - EXACT format matching the professional comparison matrix
export async function exportToExcel(
  documentA: ExtractedGuideline[] | null,
  documentB: ExtractedGuideline[] | null,
  comparisons: GuidelineComparison[] | null,
  filename: string
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  // Create the main comparison sheet
  const sheet = workbook.addWorksheet("Guideline Comparison");

  // Define colors
  const darkBlue = { argb: "1F4E78" };
  const lightBlue = { argb: "D6DCE5" };
  const greenBg = { argb: "C6EFCE" };
  const redBg = { argb: "FFC7CE" };
  const yellowBg = { argb: "FFEB9C" };
  const whiteFont = { argb: "FFFFFF" };
  const blackFont = { argb: "000000" };
  const redFont = { argb: "FF0000" };

  // Set column widths
  sheet.getColumn("A").width = 18;
  sheet.getColumn("B").width = 50;
  sheet.getColumn("C").width = 50;
  sheet.getColumn("D").width = 25;
  sheet.getColumn("E").width = 15; // Page Reference column

  // Row 1: FINDINGS KEY header
  sheet.mergeCells("A1:E1");
  const keyHeader = sheet.getCell("A1");
  keyHeader.value = "FINDINGS KEY:";
  keyHeader.font = { bold: true, size: 11 };
  keyHeader.fill = { type: "pattern", pattern: "solid", fgColor: lightBlue };
  keyHeader.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 20;

  // Row 2: Font in Red note
  sheet.mergeCells("A2:E2");
  const redNote = sheet.getCell("A2");
  redNote.value = "Font in Red is more restrictive";
  redNote.font = { size: 9, color: redFont };
  redNote.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF" } };
  sheet.getRow(2).height = 15;

  // Row 3: Green indicator - Seller is MORE Restrictive
  sheet.mergeCells("A3:E3");
  const row3 = sheet.getCell("A3");
  row3.value = "●  Seller is MORE Restrictive or we accept their guideline as is";
  row3.font = { size: 9 };
  row3.fill = { type: "pattern", pattern: "solid", fgColor: greenBg };
  row3.alignment = { vertical: "middle" };
  sheet.getRow(3).height = 18;

  // Row 4: Red indicator - Seller is LESS Restrictive
  sheet.mergeCells("A4:E4");
  const row4 = sheet.getCell("A4");
  row4.value = "●  Seller is LESS Restrictive or MUST MEET Newfi Guidelines";
  row4.font = { size: 9 };
  row4.fill = { type: "pattern", pattern: "solid", fgColor: redBg };
  row4.alignment = { vertical: "middle" };
  sheet.getRow(4).height = 18;

  // Row 5: Yellow indicator - SAME
  sheet.mergeCells("A5:E5");
  const row5 = sheet.getCell("A5");
  row5.value = "●  SAME (Similar with minor differences)";
  row5.font = { size: 9 };
  row5.fill = { type: "pattern", pattern: "solid", fgColor: yellowBg };
  row5.alignment = { vertical: "middle" };
  sheet.getRow(5).height = 18;

  // Row 6: Empty separator
  sheet.getRow(6).height = 5;

  // Row 7: Column headers (Blue background, white text)
  const headerRow = sheet.getRow(7);
  headerRow.height = 25;

  const cellA7 = sheet.getCell("A7");
  cellA7.value = "";
  cellA7.fill = { type: "pattern", pattern: "solid", fgColor: darkBlue };
  cellA7.font = { bold: true, color: whiteFont, size: 11 };
  cellA7.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const cellB7 = sheet.getCell("B7");
  cellB7.value = documentB && documentB.length > 0 ? "Newfi Guidelines" : "Newfi CORR Non-QM 3-16-2026";
  cellB7.fill = { type: "pattern", pattern: "solid", fgColor: darkBlue };
  cellB7.font = { bold: true, color: whiteFont, size: 11 };
  cellB7.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const cellC7 = sheet.getCell("C7");
  cellC7.value = documentA && documentA.length > 0 ? "Seller Guide" : "ENTER Seller Guide Name & Date Here";
  cellC7.fill = { type: "pattern", pattern: "solid", fgColor: darkBlue };
  cellC7.font = { bold: true, color: whiteFont, size: 11 };
  cellC7.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const cellD7 = sheet.getCell("D7");
  cellD7.value = "Findings";
  cellD7.fill = { type: "pattern", pattern: "solid", fgColor: darkBlue };
  cellD7.font = { bold: true, color: whiteFont, size: 11 };
  cellD7.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const cellE7 = sheet.getCell("E7");
  cellE7.value = "Page(s)";
  cellE7.fill = { type: "pattern", pattern: "solid", fgColor: darkBlue };
  cellE7.font = { bold: true, color: whiteFont, size: 11 };
  cellE7.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  // Add borders to header
  ["A7", "B7", "C7", "D7", "E7"].forEach((cellRef) => {
    const cell = sheet.getCell(cellRef);
    cell.border = {
      top: { style: "thin", color: { argb: "000000" } },
      left: { style: "thin", color: { argb: "000000" } },
      bottom: { style: "thin", color: { argb: "000000" } },
      right: { style: "thin", color: { argb: "000000" } },
    };
  });

  // Data rows
  let currentRow = 8;

  if (comparisons && comparisons.length > 0) {
    // Group by category
    const groupedByCategory = new Map<string, GuidelineComparison[]>();
    comparisons.forEach((comp) => {
      const category = comp.sellerGuideline.category || "General";
      if (!groupedByCategory.has(category)) {
        groupedByCategory.set(category, []);
      }
      groupedByCategory.get(category)!.push(comp);
    });

    const categories = Array.from(groupedByCategory.keys()).sort();

    categories.forEach((category) => {
      const comps = groupedByCategory.get(category)!;
      const categoryStartRow = currentRow;

      comps.forEach((comp, idx) => {
        // Find the best matching Newfi guideline using similarity
        const { guideline: bestMatch } = findBestMatchingNewfiGuideline(
          comp.sellerGuideline,
          documentB || []
        );
        const newfiText = bestMatch?.guideline || "N/A";

        const row = sheet.getRow(currentRow);
        row.height = 60;

        // Column A: Category (only on first row of category)
        const cellA = row.getCell(1);
        if (idx === 0) {
          cellA.value = category.toUpperCase();
          cellA.font = { bold: true, size: 10 };
        }
        cellA.fill = { type: "pattern", pattern: "solid", fgColor: lightBlue };
        cellA.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cellA.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Column B: Newfi Guidelines
        const cellB = row.getCell(2);
        cellB.value = newfiText;
        cellB.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cellB.font = { size: 9 };
        cellB.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Column C: Seller Guide
        const cellC = row.getCell(3);
        cellC.value = comp.sellerGuideline.guideline;
        cellC.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cellC.font = { size: 9 };
        cellC.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Column D: Findings
        const cellD = row.getCell(4);
        let findings = "";
        let bgColor = { argb: "FFFFFF" };

        if (comp.verdict === "GO") {
          // Only mark as SAME if similarity is high enough
          const similarity = calculateSimilarity(comp.sellerGuideline.guideline, newfiText);
          if (similarity > 0.70) {
            findings = "SAME";
          } else {
            findings = "Seller is MORE Restrictive";
          }
          bgColor = yellowBg;
        } else if (comp.verdict === "NO_GO") {
          findings = "LESS Restrictive - MUST MEET Newfi";
          bgColor = redBg;
        } else {
          findings = "REVIEW";
          bgColor = { argb: "E0E0E0" };
        }

        cellD.value = findings;
        cellD.fill = { type: "pattern", pattern: "solid", fgColor: bgColor };
        cellD.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cellD.font = { bold: true, size: 9 };
        cellD.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Column E: Page Reference
        const cellE = row.getCell(5);
        const pageRef = comp.sellerGuideline.page_reference ||
                       (comp.sellerGuideline.pages && comp.sellerGuideline.pages.length > 0
                         ? formatPageNumbers(comp.sellerGuideline.pages)
                         : "N/A");
        cellE.value = pageRef;
        cellE.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cellE.font = { size: 9 };
        cellE.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        currentRow++;
      });

      // Merge category cells for this category
      if (comps.length > 1) {
        sheet.mergeCells(categoryStartRow, 1, currentRow - 1, 1);
      }
    });
  }

  // Freeze panes at row 7
  sheet.views = [{ state: "frozen", ySplit: 7 }];

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement("a");
  link.href = url;
  link.download = filename;
  globalThis.document.body.appendChild(link);
  link.click();
  globalThis.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

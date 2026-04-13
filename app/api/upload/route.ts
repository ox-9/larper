import { NextResponse } from "next/server";
import PDFParser, { type Output } from "pdf2json";
import { newfiRowCount, tabsAvailable } from "@/lib/newfiGuidelines";

export const runtime = "nodejs";

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

type SectionChunk = {
  id: string;
  heading: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
  parentHeading: string | null;
  pages?: number[]; // Page numbers where this section content appears
};

// Silence ALL console methods during PDF parsing
function silenceConsole(): () => void {
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  const originalTrace = console.trace;

  console.warn = () => {};
  console.log = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.trace = () => {};

  return () => {
    console.warn = originalWarn;
    console.log = originalLog;
    console.error = originalError;
    console.info = originalInfo;
    console.debug = originalDebug;
    console.trace = originalTrace;
  };
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function decodePdfText(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Fast text normalization using single pass
function normalizeExtractedText(text: string): string {
  // Single pass normalization
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ");

  const lines = normalized.split("\n");
  const output: string[] = [];
  let emptyCount = 0;

  for (const rawLine of lines) {
    const compactLine = rawLine.trim();

    if (!compactLine) {
      emptyCount++;
      if (emptyCount === 1 && output.length > 0) {
        output.push("");
      }
      continue;
    }
    emptyCount = 0;

    const prev = output[output.length - 1];
    const canJoinWithPrev =
      prev &&
      prev !== "" &&
      !/[.!?:;]$/.test(prev) &&
      !/^[\-*•]/.test(compactLine);

    if (canJoinWithPrev) {
      output[output.length - 1] = `${prev} ${compactLine}`.replace(/\s+/g, " ").trim();
    } else {
      output.push(compactLine);
    }
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Dot leaders — typical table-of-contents rows. */
function isTableOfContentsLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/\.{3,}/.test(t)) return true;
  if (/^.{4,120}\s+\.{3,}\s*\d{1,4}\s*$/i.test(t)) return true;
  return false;
}

/** Standalone page number lines. */
function isLikelyPageOnlyLine(line: string): boolean {
  return /^(?:page\s*)?\d{1,4}\s*$/i.test(line.trim());
}

function headerFooterHeuristicScore(line: string): number {
  let score = 0;
  const t = line.trim();
  if (/GUIDELINES|UNDERWRITING|CONFIDENTIAL|PROPRIETARY|ALL\s+RIGHTS\s+RESERVED|©/i.test(t)) {
    score += 2;
  }
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 12) {
    const upper = (t.match(/[A-Z]/g) ?? []).length;
    if (upper / letters.length >= 0.55) score += 2;
  }
  if (/\bPAGE\s+\d+\s*\/\s*\d+\b/i.test(t)) score += 2;
  return score;
}

/** Lines that repeat and look like running headers/footers. */
function isLikelyRepeatedHeaderFooter(line: string, frequency: number): boolean {
  const t = line.trim();
  if (frequency < 3 || !t) return false;
  const len = t.length;
  if (len < 12 || len > 280) return false;
  if (headerFooterHeuristicScore(t) >= 2) return true;
  if (frequency >= 6 && len <= 200) return true;
  return false;
}

/** Fix broken number spacing. */
function fixBrokenNumberSpacing(text: string): string {
  return text
    .replace(/\b(\d+)\s+\.\s+(\d+)\b/g, "$1.$2")
    .replace(/\b(\d+\.\d+)\s+(\d)\b(?!\d)/g, "$1$2");
}

/** Fix broken section labels. */
function fixBrokenSectionLabel(text: string): string {
  return text.replace(/\bSection\s+(\d)\s+(\d)(\s*[-:])/gi, "Section $1$2$3");
}

/** Fix hyphen spacing. */
function fixHyphenSpacing(text: string): string {
  let prev = text;
  for (let i = 0; i < 3; i += 1) {
    const next = prev.replace(/\b([A-Za-z]+)\s*-\s*([A-Za-z]+)\b/g, "$1-$2");
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

/** Conservative cleanup after structural normalization. */
function cleanExtractedText(text: string): string {
  const lines = text.split("\n");
  const freq = new Map<string, number>();

  // Single pass frequency counting
  for (const raw of lines) {
    const key = raw.trim();
    if (!key) continue;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  const kept: string[] = [];
  let lastWasEmpty = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (!lastWasEmpty && kept.length > 0) {
        kept.push("");
        lastWasEmpty = true;
      }
      continue;
    }
    lastWasEmpty = false;

    if (isTableOfContentsLine(trimmed)) continue;
    if (isLikelyPageOnlyLine(trimmed)) continue;

    const count = freq.get(trimmed) ?? 0;
    if (isLikelyRepeatedHeaderFooter(trimmed, count)) continue;

    kept.push(line.replace(/[ \t]+/g, " ").trim());
  }

  let joined = kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  joined = fixBrokenNumberSpacing(joined);
  joined = fixBrokenSectionLabel(joined);
  joined = fixHyphenSpacing(joined);
  joined = joined.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return joined;
}

function normalizeSectionHeading(line: string): string {
  return line.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

function getSectionLevel(heading: string): number {
  const normalized = normalizeSectionHeading(heading);

  if (/^section\s+\d+/i.test(normalized)) {
    return 1;
  }

  const numberedMatch = normalized.match(/^(\d+(?:\.\d+)*)\b/);
  if (!numberedMatch) {
    return 0;
  }

  return numberedMatch[1].split(".").length;
}

function isSectionHeading(line: string): boolean {
  const normalized = normalizeSectionHeading(line);

  if (!normalized) {
    return false;
  }

  if (/^section\s+\d+(?:\.\d+)?\s*[-:]\s+.+/i.test(normalized)) {
    return true;
  }

  if (/^\d+(?:\.\d)*\s+.+/.test(normalized)) {
    return true;
  }

  return false;
}

function buildSectionChunks(text: string, pageMap?: Map<string, number[]>): SectionChunk[] {
  const lines = text.split("\n");
  const chunks: SectionChunk[] = [];

  let currentHeading = "Introduction";
  let currentLevel = 0;
  let currentLineStart = 1;
  let currentContent: string[] = [];
  const headingStack: Array<{ heading: string; level: number }> = [];

  const getPagesForContent = (content: string): number[] => {
    if (!pageMap) return [];
    const pages = new Set<number>();
    const contentLines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    for (const line of contentLines) {
      const linePages = pageMap.get(line);
      if (linePages) {
        linePages.forEach(p => pages.add(p));
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  const pushChunk = (lineEnd: number) => {
    const content = currentContent.join("\n").trim();

    if (!content) {
      return;
    }

    const parentHeading =
      currentLevel > 0
        ? [...headingStack].reverse().find((item) => item.level < currentLevel)?.heading ?? null
        : null;

    const pages = getPagesForContent(content);

    chunks.push({
      id: `section-${chunks.length + 1}`,
      heading: currentHeading,
      level: currentLevel,
      content,
      lineStart: currentLineStart,
      lineEnd,
      parentHeading,
      pages,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      if (currentContent.length > 0 && currentContent[currentContent.length - 1] !== "") {
        currentContent.push("");
      }
      continue;
    }

    if (isSectionHeading(line)) {
      pushChunk(index);

      currentHeading = normalizeSectionHeading(line);
      currentLevel = getSectionLevel(currentHeading);
      currentLineStart = index + 1;
      currentContent = [];

      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= currentLevel
      ) {
        headingStack.pop();
      }

      if (currentLevel > 0) {
        headingStack.push({ heading: currentHeading, level: currentLevel });
      }

      continue;
    }

    currentContent.push(line);
  }

  pushChunk(lines.length);

  return chunks;
}

// Text extraction result with page mapping
export type TextExtractionResult = {
  text: string;
  pageMap: Map<string, number[]>; // Maps text content to array of page numbers
};

// Optimized text extraction with page tracking
function extractTextFromPdfData(pdfData: Output): TextExtractionResult {
  const pages = pdfData.Pages ?? [];
  const lines: string[] = [];
  const seenLines = new Set<string>();
  const pageMap = new Map<string, number[]>();

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const texts = page.Texts ?? [];
    const pageNum = p + 1; // 1-based page numbers

    for (let t = 0; t < texts.length; t++) {
      const textItem = texts[t];
      const runs = textItem.R ?? [];

      // Fast string building
      let line = "";
      for (let r = 0; r < runs.length; r++) {
        line += decodePdfText(runs[r].T);
      }

      const trimmed = line.trim();
      if (trimmed) {
        // Track page numbers for each unique line
        if (!pageMap.has(trimmed)) {
          pageMap.set(trimmed, []);
        }
        const pageNumbers = pageMap.get(trimmed)!;
        if (!pageNumbers.includes(pageNum)) {
          pageNumbers.push(pageNum);
        }

        if (!seenLines.has(trimmed)) {
          seenLines.add(trimmed);
          lines.push(trimmed);
        }
      }
    }
  }

  return { text: lines.join("\n"), pageMap };
}

// Worker pool for parallel PDF processing
class PdfWorkerPool {
  private pool: Array<{
    id: number;
    busy: boolean;
    parser: PDFParser;
  }> = [];
  private queue: Array<{
    buffer: Buffer;
    resolve: (result: TextExtractionResult) => void;
    reject: (error: Error) => void;
  }> = [];
  private maxWorkers: number;

  constructor(maxWorkers = 4) {
    this.maxWorkers = maxWorkers;
  }

  private createWorker(id: number) {
    const parser = new PDFParser(undefined, false);
    return { id, busy: false, parser };
  }

  private init() {
    if (this.pool.length === 0) {
      for (let i = 0; i < this.maxWorkers; i++) {
        this.pool.push(this.createWorker(i));
      }
    }
  }

  async process(buffer: Buffer): Promise<TextExtractionResult> {
    this.init();

    return new Promise((resolve, reject) => {
      this.queue.push({ buffer, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.queue.length > 0) {
      const worker = this.pool.find((w) => !w.busy);
      if (!worker) break;

      const task = this.queue.shift();
      if (!task) continue;

      worker.busy = true;
      const { buffer, resolve, reject } = task;
      const restore = silenceConsole();

      const cleanup = () => {
        worker.busy = false;
        restore();
        worker.parser.removeAllListeners();
        // Recreate parser for next use
        this.pool[worker.id] = this.createWorker(worker.id);
        this.processQueue();
      };

      worker.parser.once("pdfParser_dataReady", (pdfData: Output) => {
        try {
          const extracted = extractTextFromPdfData(pdfData);
          cleanup();
          resolve(extracted);
        } catch (error) {
          cleanup();
          reject(error as Error);
        }
      });

      worker.parser.once("pdfParser_dataError", (error: Error) => {
        cleanup();
        reject(error);
      });

      try {
        worker.parser.parseBuffer(buffer);
      } catch (error) {
        cleanup();
        reject(error as Error);
      }
    }
  }

  terminate() {
    for (const worker of this.pool) {
      try {
        worker.parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.pool = [];
    this.queue = [];
  }
}

// Singleton worker pool
const pdfWorkerPool = new PdfWorkerPool(2);

function parsePdfBuffer(pdfBuffer: Buffer): Promise<TextExtractionResult> {
  return pdfWorkerPool.process(pdfBuffer);
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const entry = formData.get("file");

  if (!entry || typeof entry === "string") {
    return NextResponse.json(
      {
        success: false,
        message: 'No seller guide file provided. Include a file in the "file" field.',
      },
      { status: 400 }
    );
  }

  const file = entry;

  if (!isPdf(file)) {
    return NextResponse.json(
      { success: false, message: "Only PDF files are accepted." },
      { status: 400 }
    );
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      },
      { status: 400 }
    );
  }

  let extractedText = "";
  let pageMap = new Map<string, number[]>();
  const startTime = performance.now();

  try {
    // Use streaming for large files
    const bytes = new Uint8Array(await file.arrayBuffer());
    const buffer = Buffer.from(bytes);

    const extracted = await parsePdfBuffer(buffer);
    extractedText = cleanExtractedText(normalizeExtractedText(extracted.text));
    pageMap = extracted.pageMap;

    const duration = Math.round(performance.now() - startTime);
    console.log(`PDF extraction complete: ${file.name} (${file.size} bytes) in ${duration}ms`);
  } catch (error) {
    console.error("PDF text extraction failed", {
      fileName: file.name,
      fileSize: file.size,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        message: "Seller guide upload succeeded, but PDF text extraction failed.",
      },
      { status: 500 }
    );
  }

  const extractedCharacterCount = extractedText.length;
  const sectionChunks = buildSectionChunks(extractedText, pageMap);

  // Convert pageMap to a serializable format for the response
  const pageMapEntries = Array.from(pageMap.entries()).map(([text, pages]) => ({
    text,
    pages,
  }));

  // Return success even with empty text - let the AI try to handle it
  return NextResponse.json({
    success: true,
    fileName: file.name,
    fileSize: file.size,
    message: extractedCharacterCount === 0
      ? "PDF processed. Limited text extracted - AI will attempt to analyze available content."
      : "Seller guide received successfully.",
    newfiRowCount,
    tabsAvailable,
    extractedText,
    extractedCharacterCount,
    sectionChunks,
    sectionCount: sectionChunks.length,
    isScanned: extractedCharacterCount === 0,
    pageMap: pageMapEntries,
  });
}

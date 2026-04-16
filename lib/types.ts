import type { NewfiTab } from "./newfiGuidelines";

export type UploadResponse = {
  success: boolean;
  message: string;
  fileName?: string;
  fileSize?: number;
  newfiRowCount?: number;
  tabsAvailable?: NewfiTab[];
  extractedText?: string;
  extractedCharacterCount?: number;
  sectionChunks?: SectionChunk[];
  sectionCount?: number;
};

export type SectionChunk = {
  id: string;
  heading: string;
  level: number;
  content: string;
  lineStart: number;
  lineEnd: number;
  parentHeading: string | null;
};

export type TabAnalysis = {
  tab: NewfiTab;
  score: number;
  coveredTopics: string[];
  missingTopics: string[];
  recommendations: string[];
  matchedGuidelines: GuidelineMatch[];
};

export type GuidelineMatch = {
  rowNumber: number;
  category: string;
  topic: string;
  guideline: string;
  foundInSellerGuide: boolean;
  evidence?: string;
  confidence: "high" | "medium" | "low";
};

export type AnalysisResult = {
  overallScore: number;
  summary: string;
  tabAnalyses: TabAnalysis[];
  criticalIssues: string[];
  extractedTopics: string[];
  processedAt: string;
  fileName: string;
};

export type HistoryEntry = {
  id: string;
  fileName: string;
  fileSize: number;
  overallScore: number;
  processedAt: string;
  summary: string;
};

export type ProcessingState = {
  stage: "idle" | "uploading" | "extracting" | "analyzing" | "complete" | "error";
  message: string;
  progress: number;
};

// ===== NEW TYPES FOR UPGRADED APP =====

export type ExtractedGuideline = {
  id: string;
  category: string;
  guideline: string;
  page_reference?: string;
  severity: "critical" | "standard" | "informational";
  sourceDocument?: "A" | "B" | "C";
  // Array of page numbers where this guideline appears
  pages?: number[];
};

export type ExtractionResult = {
  success: boolean;
  guidelines: ExtractedGuideline[];
  fileName: string;
  pageCount: number;
  fileSize: number;
  extractedAt: string;
  error?: string;
};

export type ComparisonVerdict = "Match" | "Partial" | "Conflict" | "Gap";

export type GuidelineComparison = {
  id: string;
  sellerGuideline: ExtractedGuideline | null;
  newfiGuideline: ExtractedGuideline;
  verdict: ComparisonVerdict;
  confidence: number;
  reason: string;
  conflictingNewfiRule: string | null;
  verbatimQuote: string;
  overlayApplied: boolean;
};

export type ComparisonResult = {
  totalGuidelines: number;
  matchCount: number;
  partialCount: number;
  conflictCount: number;
  gapCount: number;
  complianceScore: number;
  overallVerdict: "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT";
  comparisons: GuidelineComparison[];
  comparedAt: string;
};

export type OverlayAdjustment = {
  originalText: string;
  adjustedText: string;
  source: string;
};

export type DocumentInfo = {
  file: File | null;
  name: string;
  size: number;
  uploaded: boolean;
  extracting: boolean;
  extracted: boolean;
  guidelines: ExtractedGuideline[];
  pageCount: number;
  error?: string;
};

export type AppState = {
  documentA: DocumentInfo;
  documentB: DocumentInfo;
  overlayDocument: DocumentInfo;
  isExtracting: boolean;
  extractionProgress: number;
  comparisonResult: ComparisonResult | null;
  isComparing: boolean;
  comparisonProgress: number;
  newfiBaselineText: string;
  activePage: "upload" | "compare";
};
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
  sourceDocument?: "A" | "B";
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

export type ComparisonVerdict = "GO" | "NO_GO" | "REVIEW";

export type GuidelineComparison = {
  id: string;
  sellerGuideline: ExtractedGuideline;
  verdict: ComparisonVerdict;
  confidence: number;
  reason: string;
  conflictingNewfiRule: string | null;
};

export type ComparisonResult = {
  totalGuidelines: number;
  goCount: number;
  noGoCount: number;
  reviewCount: number;
  complianceScore: number;
  overallVerdict: "FULLY_COMPLIANT" | "NON_COMPLIANT" | "REVIEW_REQUIRED";
  comparisons: GuidelineComparison[];
  comparedAt: string;
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
};

export type AppState = {
  documentA: DocumentInfo;
  documentB: DocumentInfo;
  isExtracting: boolean;
  extractionProgress: number;
  comparisonResult: ComparisonResult | null;
  isComparing: boolean;
  comparisonProgress: number;
  newfiBaselineText: string;
  activePage: "upload" | "compare";
};
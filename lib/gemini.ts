import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ExtractedGuideline,
  ExtractionResult,
  GuidelineComparison,
  ComparisonResult,
  ComparisonVerdict
} from "./types";

// Initialize Gemini client - LAZY: only throws when actually used
function getGeminiClient(): GoogleGenerativeAI {
  // Check for runtime key from localStorage first (set via provider-detection)
  let apiKey: string | null = null;
  if (typeof window !== "undefined") {
    apiKey = localStorage.getItem("gemini_api_key");
  }
  // Fall back to build-time env var
  if (!apiKey) {
    apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
  }
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Add it in Settings or set NEXT_PUBLIC_GEMINI_API_KEY.");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Retry with exponential backoff for rate limits
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a rate limit error (429)
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // If it's not a rate limit error, throw immediately
      throw error;
    }
  }

  throw lastError;
}

// Convert File to base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get pure base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extract guidelines from PDF using Gemini
export async function extractGuidelinesFromPDF(
  file: File,
  documentType: "A" | "B" | "C"
): Promise<ExtractionResult> {
  try {
    // Check file size - Gemini has a 20MB limit for inline data
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        guidelines: [],
        fileName: file.name,
        pageCount: 0,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
        error: `PDF file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 20MB for AI extraction.`,
      };
    }

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const base64Data = await fileToBase64(file);

    const extractionPrompt = `You are a mortgage guideline extraction expert. Extract ALL guidelines, rules, requirements, restrictions, and policies from this document. Organize them by category (e.g. Credit Requirements, LTV, Income, Property, Loan Limits, Seasoning Requirements, etc.). Return as a structured JSON array where each item has: { id, category, guideline, page_reference (if visible), severity (critical/standard/informational) }

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no explanation. The response must be a valid JSON array.`;

    const result = await retryWithBackoff(async () => {
      return await model.generateContent([
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        },
        { text: extractionPrompt },
      ]);
    });

    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    let guidelines: ExtractedGuideline[] = [];
    try {
      // Handle potential markdown code blocks
      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed)) {
        guidelines = parsed.map((item, index) => ({
          id: item.id || `guideline-${documentType}-${index + 1}`,
          category: item.category || "Uncategorized",
          guideline: item.guideline || item.text || "",
          page_reference: item.page_reference || item.pageReference || undefined,
          severity: ["critical", "standard", "informational"].includes(item.severity)
            ? item.severity
            : "standard",
          sourceDocument: documentType,
        }));
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", text);

      // Return a fallback with the raw text as a single guideline
      guidelines = [{
        id: `guideline-${documentType}-1`,
        category: "Raw Extraction",
        guideline: text.slice(0, 500) + (text.length > 500 ? "..." : ""),
        severity: "standard",
        sourceDocument: documentType,
      }];
    }

    return {
      success: true,
      guidelines,
      fileName: file.name,
      pageCount: Math.ceil(file.size / 50000), // Rough estimate
      fileSize: file.size,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Use warn instead of error since this may be used as a fallback extraction method
    console.warn("Gemini PDF extraction unavailable:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    // Check for quota errors (429)
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      return {
        success: false,
        guidelines: [],
        fileName: file.name,
        pageCount: 0,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
        error: "API quota exceeded. Please wait a minute and try again, or use a different Gemini API key. Get a free key at: https://aistudio.google.com/apikey",
      };
    }

    // Check for bad request (400) - usually malformed PDF or file too large
    if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
      return {
        success: false,
        guidelines: [],
        fileName: file.name,
        pageCount: 0,
        fileSize: file.size,
        extractedAt: new Date().toISOString(),
        error: "AI extraction failed: The PDF file may be corrupted, password-protected, or use an unsupported format. Try a different PDF file.",
      };
    }

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

// Compare seller guideline against Newfi baseline (reuses client instance)
async function compareGuidelineWithClient(
  genAI: GoogleGenerativeAI,
  sellerGuideline: ExtractedGuideline,
  newfiGuidelines: ExtractedGuideline[]
): Promise<GuidelineComparison> {
  // Find best matching Newfi guideline for the result (outside try so catch can access it)
  const relevantNewfiGuidelines = newfiGuidelines.filter(
    (g) => g.category === sellerGuideline.category || g.category === "All"
  );
  const bestNewfiMatch = relevantNewfiGuidelines.length > 0 ? relevantNewfiGuidelines[0] : newfiGuidelines[0];

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const newfiGuidelinesText = relevantNewfiGuidelines.length > 0
      ? relevantNewfiGuidelines.map((g) => `- ${g.guideline}`).join("\n")
      : "No specific Newfi guidelines found for this category.";

    const comparisonPrompt = `You are a mortgage compliance expert. Compare this seller guideline against the Newfi baseline guidelines and determine compatibility.

Seller Guideline: ${sellerGuideline.guideline}
Category: ${sellerGuideline.category}

Newfi Baseline Guidelines for this category:
${newfiGuidelinesText}

Respond ONLY with valid JSON:
{
  "verdict": "Match" | "Partial" | "Conflict" | "Gap",
  "confidence": number (0-100),
  "reason": string (one sentence max),
  "conflicting_newfi_rule": string | null,
  "verbatim_quote": string
}`;

    const result = await retryWithBackoff(async () => {
      return await model.generateContent([{ text: comparisonPrompt }]);
    });
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    let parsed: {
      verdict?: string;
      confidence?: number;
      reason?: string;
      conflicting_newfi_rule?: string | null;
      verbatim_quote?: string;
    } = {};

    try {
      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        verdict: "Gap",
        confidence: 50,
        reason: "Analysis failed — manual review required",
        conflicting_newfi_rule: null,
      };
    }

    const validVerdicts: ComparisonVerdict[] = ["Match", "Partial", "Conflict", "Gap"];
    const verdict = validVerdicts.includes(parsed.verdict as ComparisonVerdict)
      ? (parsed.verdict as ComparisonVerdict)
      : "Gap";

    return {
      id: `comparison-${sellerGuideline.id}`,
      sellerGuideline,
      newfiGuideline: bestNewfiMatch,
      verdict,
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      reason: parsed.reason || "Analysis completed",
      conflictingNewfiRule: parsed.conflicting_newfi_rule || null,
      verbatimQuote: parsed.verbatim_quote || sellerGuideline.guideline.slice(0, 200),
      overlayApplied: false,
    };
  } catch (error) {
    return {
      id: `comparison-${sellerGuideline.id}`,
      sellerGuideline,
      newfiGuideline: bestNewfiMatch,
      verdict: "Gap" as ComparisonVerdict,
      confidence: 0,
      reason: "Analysis failed — manual review required",
      conflictingNewfiRule: null,
      verbatimQuote: sellerGuideline.guideline.slice(0, 200),
      overlayApplied: false,
    };
  }
}

// Batch compare guidelines with high parallelism
export async function batchCompareGuidelines(
  sellerGuidelines: ExtractedGuideline[],
  newfiGuidelines: ExtractedGuideline[],
  onProgress?: (current: number, total: number) => void
): Promise<ComparisonResult> {
  const comparisons: GuidelineComparison[] = [];
  const batchSize = 15;
  const totalGuidelines = sellerGuidelines.length;

  // Reuse a single Gemini client instance
  const genAI = getGeminiClient();

  for (let i = 0; i < sellerGuidelines.length; i += batchSize) {
    const batch = sellerGuidelines.slice(i, i + batchSize);

    // Process batch in parallel with shared client
    const batchResults = await Promise.all(
      batch.map((guideline) => compareGuidelineWithClient(genAI, guideline, newfiGuidelines))
    );

    comparisons.push(...batchResults);

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, totalGuidelines), totalGuidelines);
    }
  }

  // Calculate statistics
  const matchCount = comparisons.filter((c) => c.verdict === "Match").length;
  const partialCount = comparisons.filter((c) => c.verdict === "Partial").length;
  const conflictCount = comparisons.filter((c) => c.verdict === "Conflict").length;
  const gapCount = comparisons.filter((c) => c.verdict === "Gap").length;
  const complianceScore = totalGuidelines > 0
    ? Math.round((matchCount / totalGuidelines) * 100)
    : 0;

  let overallVerdict: "COMPLIANT" | "NON_COMPLIANT" | "PARTIALLY_COMPLIANT";
  if (conflictCount > 0) {
    overallVerdict = "NON_COMPLIANT";
  } else if (matchCount === totalGuidelines) {
    overallVerdict = "COMPLIANT";
  } else {
    overallVerdict = "PARTIALLY_COMPLIANT";
  }

  return {
    totalGuidelines,
    matchCount,
    partialCount,
    conflictCount,
    gapCount,
    complianceScore,
    overallVerdict,
    comparisons,
    comparedAt: new Date().toISOString(),
  };
}

// Export to CSV
export function exportToCSV(
  data: ExtractedGuideline[] | GuidelineComparison[],
  type: "guidelines" | "comparison" | "conflicts-only"
): string {
  if (type === "guidelines") {
    const guidelines = data as ExtractedGuideline[];
    const headers = ["ID", "Category", "Guideline Text", "Severity", "Source Document", "Page Reference"];
    const rows = guidelines.map((g) => [
      g.id,
      g.category,
      `"${g.guideline.replace(/"/g, '""')}"`,
      g.severity,
      g.sourceDocument || "N/A",
      g.page_reference || "N/A",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  if (type === "comparison" || type === "conflicts-only") {
    const comparisons = (data as GuidelineComparison[]).filter(
      (c) => type === "comparison" || c.verdict === "Conflict"
    );
    const headers = ["#", "Category", "Newfi Guideline", "Seller Guideline", "Findings", "Confidence%", "Reason", "Verbatim Quote", "Page(s)"];
    const rows = comparisons.map((c, i) => [
      i + 1,
      c.newfiGuideline.category,
      `"${c.newfiGuideline.guideline.replace(/"/g, '""')}"`,
      c.sellerGuideline ? `"${c.sellerGuideline.guideline.replace(/"/g, '""')}"` : "Not addressed",
      c.verdict,
      c.confidence,
      `"${c.reason.replace(/"/g, '""')}"`,
      `"${c.verbatimQuote.replace(/"/g, '""')}"`,
      c.sellerGuideline?.page_reference || "N/A",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  return "";
}

// Download CSV file
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
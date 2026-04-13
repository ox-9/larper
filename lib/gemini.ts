import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ExtractedGuideline,
  ExtractionResult,
  GuidelineComparison,
  ComparisonResult,
  ComparisonVerdict
} from "./types";

// Initialize Gemini client
function getGeminiClient() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables");
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
  documentType: "A" | "B"
): Promise<ExtractionResult> {
  try {
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
    console.error("PDF extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    // Check for quota errors
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
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Find relevant Newfi guidelines for the same category
    const relevantNewfiGuidelines = newfiGuidelines.filter(
      (g) => g.category === sellerGuideline.category || g.category === "All"
    );

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
  "verdict": "GO" | "NO_GO" | "REVIEW",
  "confidence": number (0-100),
  "reason": string (one sentence max),
  "conflicting_newfi_rule": string | null
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
        verdict: "REVIEW",
        confidence: 50,
        reason: "Analysis failed — manual review required",
        conflicting_newfi_rule: null,
      };
    }

    const validVerdicts: ComparisonVerdict[] = ["GO", "NO_GO", "REVIEW"];
    const verdict = validVerdicts.includes(parsed.verdict as ComparisonVerdict)
      ? (parsed.verdict as ComparisonVerdict)
      : "REVIEW";

    return {
      id: `comparison-${sellerGuideline.id}`,
      sellerGuideline,
      verdict,
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      reason: parsed.reason || "Analysis completed",
      conflictingNewfiRule: parsed.conflicting_newfi_rule || null,
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

// Export to CSV
export function exportToCSV(
  data: ExtractedGuideline[] | GuidelineComparison[],
  type: "guidelines" | "comparison" | "critical-only"
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

  if (type === "comparison" || type === "critical-only") {
    const comparisons = (data as GuidelineComparison[]).filter(
      (c) => type === "comparison" || c.verdict === "NO_GO"
    );
    const headers = ["#", "Category", "Guideline", "Source", "Verdict", "Confidence%", "Reason", "Conflicting Rule"];
    const rows = comparisons.map((c, i) => [
      i + 1,
      c.sellerGuideline.category,
      `"${c.sellerGuideline.guideline.replace(/"/g, '""')}"`,
      c.sellerGuideline.sourceDocument || "A",
      c.verdict,
      c.confidence,
      `"${c.reason.replace(/"/g, '""')}"`,
      c.conflictingNewfiRule ? `"${c.conflictingNewfiRule.replace(/"/g, '""')}"` : "N/A",
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
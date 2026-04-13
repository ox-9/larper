import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult, TabAnalysis, GuidelineMatch } from "./types";
import { newfiGuidelineRows, type NewfiTab } from "./newfiGuidelines";

function getGeminiClient() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

function buildSystemPrompt(): string {
  const guidelinesText = newfiGuidelineRows
    .map(
      (row) =>
        `[${row.tab}] ${row.category} > ${row.topic}: ${row.newfiGuideline}`
    )
    .join("\n");

  return `You are a mortgage guideline compliance analyst. You analyze seller guide documents against internal Newfi underwriting guidelines.

Your task is to compare the extracted seller guide text against the following Newfi internal guidelines and provide a detailed compliance analysis.

## Newfi Internal Guidelines:
${guidelinesText}

## Analysis Requirements:
1. For EACH guideline, determine if the seller guide adequately addresses it
2. Provide confidence levels: "high" (explicitly mentioned), "medium" (implied or partially addressed), "low" (unclear or missing)
3. Quote evidence from the seller guide text when found
4. Calculate compliance scores (0-100) for each tab (NON-QM, DSCR)
5. Identify critical issues that could cause loan rejection
6. Suggest actionable recommendations for improvement

## Response Format:
Respond with ONLY valid JSON (no markdown code blocks, no explanation). The response must be a JSON object matching this structure:
{
  "overallScore": number (0-100),
  "summary": string (2-3 sentences),
  "tabAnalyses": [
    {
      "tab": "NON-QM" | "DSCR",
      "score": number (0-100),
      "coveredTopics": string[],
      "missingTopics": string[],
      "recommendations": string[],
      "matchedGuidelines": [
        {
          "rowNumber": number,
          "category": string,
          "topic": string,
          "guideline": string,
          "foundInSellerGuide": boolean,
          "evidence": string or null,
          "confidence": "high" | "medium" | "low"
        }
      ]
    }
  ],
  "criticalIssues": string[],
  "extractedTopics": string[]
}`;
}

function buildUserPrompt(extractedText: string, fileName: string): string {
  return `Analyze this seller guide document against the Newfi internal guidelines.

File: ${fileName}
Extracted Text Length: ${extractedText.length} characters

## Seller Guide Content:
${extractedText.slice(0, 50000)}

Provide a comprehensive compliance analysis as JSON.`;
}

function parseAnalysisResponse(
  content: string,
  fileName: string
): AnalysisResult {
  try {
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and transform the response
    const tabAnalyses: TabAnalysis[] = (parsed.tabAnalyses || []).map(
      (ta: Record<string, unknown>) => {
        const tab = (ta.tab as NewfiTab) || "NON-QM";
        const matchedGuidelines: GuidelineMatch[] = (
          (ta.matchedGuidelines as Array<Record<string, unknown>>) ||
          []
        ).map((mg: Record<string, unknown>) => ({
          rowNumber: (mg.rowNumber as number) || 0,
          category: (mg.category as string) || "",
          topic: (mg.topic as string) || "",
          guideline: (mg.guideline as string) || "",
          foundInSellerGuide: (mg.foundInSellerGuide as boolean) ?? false,
          evidence: (mg.evidence as string) || undefined,
          confidence: (mg.confidence as "high" | "medium" | "low") || "low",
        }));

        return {
          tab,
          score: Math.min(100, Math.max(0, (ta.score as number) || 0)),
          coveredTopics: (ta.coveredTopics as string[]) || [],
          missingTopics: (ta.missingTopics as string[]) || [],
          recommendations: (ta.recommendations as string[]) || [],
          matchedGuidelines,
        };
      }
    );

    return {
      overallScore: Math.min(
        100,
        Math.max(0, parsed.overallScore as number) || 0
      ),
      summary: (parsed.summary as string) || "Analysis completed.",
      tabAnalyses,
      criticalIssues: (parsed.criticalIssues as string[]) || [],
      extractedTopics: (parsed.extractedTopics as string[]) || [],
      processedAt: new Date().toISOString(),
      fileName,
    };
  } catch {
    // Fallback: return a basic analysis
    return createFallbackAnalysis(fileName);
  }
}

function createFallbackAnalysis(fileName: string): AnalysisResult {
  return {
    overallScore: 0,
    summary:
      "Unable to parse AI analysis. Please try again with a different document.",
    tabAnalyses: [
      {
        tab: "NON-QM",
        score: 0,
        coveredTopics: [],
        missingTopics: newfiGuidelineRows
          .filter((r) => r.tab === "NON-QM")
          .map((r) => r.topic),
        recommendations: ["Retry the analysis"],
        matchedGuidelines: [],
      },
      {
        tab: "DSCR",
        score: 0,
        coveredTopics: [],
        missingTopics: newfiGuidelineRows
          .filter((r) => r.tab === "DSCR")
          .map((r) => r.topic),
        recommendations: ["Retry the analysis"],
        matchedGuidelines: [],
      },
    ],
    criticalIssues: ["Analysis parsing failed"],
    extractedTopics: [],
    processedAt: new Date().toISOString(),
    fileName,
  };
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

export async function analyzeSellerGuide(
  extractedText: string,
  fileName: string
): Promise<AnalysisResult> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await retryWithBackoff(async () => {
      return await model.generateContent([
        { text: buildSystemPrompt() },
        { text: buildUserPrompt(extractedText, fileName) },
      ]);
    });

    const content = result.response.text();

    return parseAnalysisResponse(content, fileName);
  } catch (error) {
    console.error("AI analysis failed:", error);
    return createFallbackAnalysis(fileName);
  }
}
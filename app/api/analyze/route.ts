import { NextResponse } from "next/server";
import { analyzeSellerGuide } from "@/lib/ai";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    extractedText?: string;
    fileName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { extractedText, fileName } = body;

  if (!extractedText || typeof extractedText !== "string") {
    return NextResponse.json(
      { success: false, message: "Missing or invalid extractedText field." },
      { status: 400 }
    );
  }

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json(
      { success: false, message: "Missing or invalid fileName field." },
      { status: 400 }
    );
  }

  try {
    console.log("Starting AI analysis", {
      fileName,
      textLength: extractedText.length,
    });

    const analysis: AnalysisResult = await analyzeSellerGuide(
      extractedText,
      fileName
    );

    console.log("AI analysis complete", {
      fileName,
      overallScore: analysis.overallScore,
      tabCount: analysis.tabAnalyses.length,
    });

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("AI analysis failed", { fileName, error });
    return NextResponse.json(
      {
        success: false,
        message: "AI analysis failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
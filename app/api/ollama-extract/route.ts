import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

// Content-based severity detection
function detectSeverityFromContent(text: string): "critical" | "standard" | "informational" {
  const criticalPatterns = [
    /\bmust\b/i, /\bshall\b/i, /\brequired\b/i, /\bmandatory\b/i,
    /\bprohibited\b/i, /\bnot allowed\b/i, /\bmust not\b/i, /\bshall not\b/i,
    /\bineligible\b/i, /\bnot eligible\b/i, /\bnot permitted\b/i,
    /\bmay not\b/i, /\bcannot\b/i,
    /\bno\s+\w+\s+(?:may|allowed|permitted|accepted)\b/i,
    /\bdisqualif/i, /\bexcluded?\b/i,
  ];

  for (const pattern of criticalPatterns) {
    if (pattern.test(text)) return "critical";
  }

  if (/\b(ltv|cltv|hcltv|dti|fico)\s*(?:is|must|shall|of|at|maximum|minimum)?\s*\(?\s*\d+/i.test(text) ||
      /\$\d{1,3}(,\d{3})+/.test(text) ||
      /\d+(?:\.\d+)?%/.test(text)) {
    return "critical";
  }

  const informationalPatterns = [
    /\bnote:?\b/i, /\bguidance\b/i, /\bconsider\b/i,
    /\boptional\b/i, /\bclarification\b/i,
    /\bmay\b(?! not)/i,
  ];

  for (const pattern of informationalPatterns) {
    if (pattern.test(text)) return "informational";
  }

  return "standard";
}

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    const docType = (formData.get("docType") as "A" | "B") || "A";

    if (!entry || typeof entry === "string") {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    const file = entry;

    if (!isPdf(file)) {
      return NextResponse.json(
        { success: false, message: "Only PDF files accepted" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "File too large" },
        { status: 400 }
      );
    }

    // Create temp directory
    tempDir = join(tmpdir(), `ollama-extract-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    // Save PDF
    const bytes = new Uint8Array(await file.arrayBuffer());
    const tempPdfPath = join(tempDir, file.name);
    await writeFile(tempPdfPath, Buffer.from(bytes));

    // Run the fast extraction pipeline (Python extract → Ollama group)
    // The script handles Ollama availability internally and falls back to Python-only
    const scriptPath = join(process.cwd(), "ollama_guideline_extractor.py");
    const outputJson = join(tempDir, "output.json");

    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${tempPdfPath}" -o "${outputJson}" -t "${docType}"`,
      { timeout: 300000 }
    );

    console.log("[Ollama extract]:", stdout?.slice(-500));
    if (stderr) console.error("[Ollama stderr]:", stderr?.slice(-500));

    // Read results
    if (!existsSync(outputJson)) {
      throw new Error("Extraction did not produce output");
    }

    const jsonContent = await readFile(outputJson, "utf-8");
    const rawGuidelines = JSON.parse(jsonContent);

    if (!Array.isArray(rawGuidelines) || rawGuidelines.length === 0) {
      throw new Error("Extraction returned no guidelines");
    }

    // Transform to app format
    const guidelines = rawGuidelines.map((g: any, idx: number) => {
      const text = g.guideline || g.content || "";
      return {
        id: g.id || `guideline-${docType}-${idx + 1}`,
        category: g.category || "General",
        guideline: text,
        page_reference: g.page_reference || "",
        severity: g.severity || detectSeverityFromContent(text),
        sourceDocument: docType,
        pages: (g.page_reference || "")
          .split(/[,\s]+/)
          .map(Number)
          .filter((n: number) => !isNaN(n) && n > 0)
          .concat(g.page_number ? [g.page_number] : [1]),
      };
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      message: `Extracted ${guidelines.length} guidelines`,
      guidelines,
      extractionMethod: "ollama-ai",
      guidelineCount: guidelines.length,
    });

  } catch (error) {
    console.error("Ollama extraction error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Extraction failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      try { await rm(tempDir, { recursive: true }); } catch {}
    }
  }
}
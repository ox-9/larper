import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

export const runtime = "nodejs";

// Content-based severity detection
function detectSeverityFromContent(text: string, level?: number): "critical" | "standard" | "informational" {
  const criticalPatterns = [
    /\bmust\b/i, /\bshall\b/i, /\brequired\b/i, /\bmandatory\b/i,
    /\bprohibited\b/i, /\bnot allowed\b/i, /\bmust not\b/i, /\bshall not\b/i,
    /\bineligible\b/i, /\bnot eligible\b/i, /\bnot permitted\b/i,
    /\bmay not\b/i,
    /\bno\s+\w+\s+(?:may|allowed|permitted|accepted)\b/i,
    /\bdisqualif/i, /\bexcluded?\b/i, /\bcannot\b/i,
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
    /\boptional\b/i, /\bclarification\b/i, /\bfor information\b/i,
    /\bmay\b(?! not)/i,
  ];

  for (const pattern of informationalPatterns) {
    if (pattern.test(text)) return "informational";
  }

  return "standard";
}

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export async function POST(request: Request) {
  let tempDir: string | null = null;
  let tempPdfPath: string | null = null;

  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    const usePython = formData.get("usePython") === "true";

    if (!entry || typeof entry === "string") {
      return NextResponse.json(
        { success: false, message: 'No file provided.' },
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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 400 }
      );
    }

    // Create temp directory
    tempDir = join(tmpdir(), `pdf-extract-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    // Save uploaded file
    const bytes = new Uint8Array(await file.arrayBuffer());
    tempPdfPath = join(tempDir, file.name);
    await writeFile(tempPdfPath, Buffer.from(bytes));

    // Run Python extraction script (use Pro version for best coverage)
    const scriptPath = join(process.cwd(), "extract_guidelines_pro.py");
    const outputJsonPath = join(tempDir, "output.json");
    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${tempPdfPath}" -o "${outputJsonPath}"`,
      { timeout: 120000 }
    );

    if (stderr) {
      console.error("Python stderr:", stderr);
    }

    console.log("Python stdout:", stdout);

    // Read the generated JSON file
    const jsonPath = join(tempDir, "output.json");

    if (!existsSync(jsonPath)) {
      throw new Error("Python extraction did not produce output file");
    }

    const jsonContent = await import("fs/promises").then(fs =>
      fs.readFile(jsonPath, "utf-8")
    );

    const sections = JSON.parse(jsonContent);

    // Transform to our app's format
    const guidelines = sections.map((section: any) => {
      // Build guideline text with section number if available
      let guidelineText = "";
      if (section.section_number) {
        guidelineText = `[${section.section_number}] ${section.title}\n\n${section.content}`;
      } else if (section.title) {
        guidelineText = `${section.title}\n\n${section.content}`;
      } else {
        guidelineText = section.content || "";
      }

      return {
        id: section.id || `guideline-${section.page_number}-${Math.random().toString(36).substr(2, 9)}`,
        category: section.category || "General",
        guideline: guidelineText.trim(),
        page_reference: section.pages ? section.pages.join(", ") : String(section.page_number),
        severity: detectSeverityFromContent(section.content || "", section.level),
        sourceDocument: "A" as "A" | "B",
        pages: section.pages || [section.page_number],
      };
    });

    // Extract raw text for fallback
    const rawText = sections.map((s: any) =>
      `${s.title}\n${s.content}`
    ).join("\n\n");

    // Build section chunks
    const sectionChunks = sections.map((section: any) => ({
      id: section.id || `section-${section.page_number}`,
      heading: section.title || "Section",
      level: section.level || 0,
      content: section.content || "",
      lineStart: 1,
      lineEnd: section.content ? section.content.split("\n").length : 1,
      parentHeading: section.parent_id || null,
      pages: [section.page_number],
    }));

    // Cleanup
    try {
      if (tempDir) {
        const { rm } = await import("fs/promises");
        await rm(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      message: `Extracted ${guidelines.length} guidelines from PDF.`,
      extractedText: rawText,
      extractedCharacterCount: rawText.length,
      sectionChunks,
      sectionCount: sectionChunks.length,
      guidelines,
      extractionMethod: "pdfplumber",
      isScanned: false,
    });

  } catch (error) {
    console.error("Extraction error:", error);

    // Cleanup on error
    try {
      if (tempDir) {
        const { rm } = await import("fs/promises");
        await rm(tempDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      {
        success: false,
        message: "PDF extraction failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

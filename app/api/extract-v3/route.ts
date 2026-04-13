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

// In-memory cache for Pass 1/2 results
const extractionCache = new Map<string, {
  tempDir: string;
  pdfPath: string;
  fileName: string;
  headersJsonPath: string;
}>();

// Cleanup old cache entries (run this check when adding new entries)

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const pass = formData.get("pass") as string || "1";
    const cacheKey = formData.get("cacheKey") as string;

    // PASS 1: Save file and extract all text
    if (pass === "1") {
      const entry = formData.get("file");
      if (!entry || typeof entry === "string") {
        return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
      }
      const file = entry;

      // Create temp directory
      const newCacheKey = randomUUID();
      tempDir = join(tmpdir(), `pdf-extract-v3-${newCacheKey}`);
      await mkdir(tempDir, { recursive: true });

      // Save uploaded file
      const bytes = new Uint8Array(await file.arrayBuffer());
      const tempPdfPath = join(tempDir, file.name);
      await writeFile(tempPdfPath, Buffer.from(bytes));

      // Store in cache
      extractionCache.set(newCacheKey, {
        tempDir,
        pdfPath: tempPdfPath,
        fileName: file.name,
        headersJsonPath: join(tempDir, "headers.json"),
      });

      // Get file stats for preview
      const { stdout } = await execAsync(
        `python -c "
import pdfplumber
with pdfplumber.open('${tempPdfPath.replace(/\\/g, "\\\\")}') as pdf:
    total_pages = len(pdf.pages)
    sample_text = ''
    total_chars = 0
    for i, page in enumerate(pdf.pages[:3]):
        text = page.extract_text() or ''
        total_chars += len(text)
        if len(sample_text) < 500:
            sample_text += text[:500 - len(sample_text)]
    print(f'PAGES:{total_pages}')
    print(f'CHARS:{total_chars}')
    print(f'SAMPLE:{sample_text[:300]}')
"`,
        { timeout: 60000 }
      );

      const lines = stdout.split("\n");
      const totalPages = parseInt(lines.find(l => l.startsWith("PAGES:"))?.replace("PAGES:", "") || "0");
      const totalChars = parseInt(lines.find(l => l.startsWith("CHARS:"))?.replace("CHARS:", "") || "0");
      const sampleText = lines.find(l => l.startsWith("SAMPLE:"))?.replace("SAMPLE:", "") || "";

      return NextResponse.json({
        success: true,
        pass: 1,
        cacheKey: newCacheKey,
        totalPages,
        totalChars,
        preview: sampleText,
      });
    }

    // PASS 2: Find all headers
    if (pass === "2") {
      if (!cacheKey || !extractionCache.has(cacheKey)) {
        return NextResponse.json({ error: "Cache expired. Please restart extraction." }, { status: 400 });
      }

      const cached = extractionCache.get(cacheKey)!;

      // Run Python script to extract headers only
      const scriptPath = join(process.cwd(), "extract_sections.py");
      const { stdout, stderr } = await execAsync(
        `python "${scriptPath}" "${cached.pdfPath}" --headers-only -o "${cached.headersJsonPath}"`,
        { timeout: 120000 }
      );

      if (stderr) {
        console.error("Python stderr:", stderr);
      }

      // Read the headers JSON
      if (!existsSync(cached.headersJsonPath)) {
        throw new Error("Header extraction did not produce output file");
      }

      const headersContent = await readFile(cached.headersJsonPath, "utf-8");
      const headers = JSON.parse(headersContent);

      return NextResponse.json({
        success: true,
        pass: 2,
        cacheKey,
        headerCount: headers.length,
        headers: headers.map((h: any, idx: number) => ({
          index: idx,
          type: h.type || "section",
          sectionNumber: h.section_number || null,
          title: h.title,
          page: h.page_number,
          level: h.level || 1,
        })),
      });
    }

    // PASS 3: Build final guidelines from selected headers
    if (pass === "3") {
      const approvedIndices = JSON.parse(formData.get("approvedIndices") as string || "[]") as number[];

      if (!cacheKey || !extractionCache.has(cacheKey)) {
        return NextResponse.json({ error: "Cache expired. Please restart extraction." }, { status: 400 });
      }

      const cached = extractionCache.get(cacheKey)!;

      // Read all headers
      const headersContent = await readFile(cached.headersJsonPath, "utf-8");
      const allHeaders = JSON.parse(headersContent);

      // Filter to selected headers
      const selectedHeaders = approvedIndices.length > 0
        ? approvedIndices.map(i => allHeaders[i]).filter(Boolean)
        : allHeaders;

      // Build guidelines
      const guidelines = selectedHeaders.map((h: any, idx: number) => ({
        id: h.id || `GL-${String(idx + 1).padStart(3, "0")}`,
        sectionNumber: h.section_number || null,
        title: h.title,
        content: h.content || "(See document for details)",
        page: h.page_number,
        pages: h.pages || [h.page_number],
        level: h.level || 1,
        category: h.category || "General",
        severity: h.level === 1 ? "critical" : "standard",
      }));

      // Cleanup
      try {
        await rm(cached.tempDir, { recursive: true });
      } catch {}
      extractionCache.delete(cacheKey);

      return NextResponse.json({
        success: true,
        pass: 3,
        guidelineCount: guidelines.length,
        guidelines,
      });
    }

    return NextResponse.json({ error: "Invalid pass number" }, { status: 400 });

  } catch (error) {
    console.error("Extraction error:", error);

    // Cleanup on error
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true });
      } catch {}
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 }
    );
  }
}

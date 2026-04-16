"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  DocumentInfo,
  ExtractionResult,
  ComparisonResult,
  ExtractedGuideline,
} from "./types";
import {
  extractGuidelinesFromPDF as extractWithGemini,
} from "./gemini";
import {
  batchCompareGuidelines,
  exportToExcel,
} from "./ai-provider";
import { getGeminiApiKey } from "./provider-detection";
import { extractGuidelinesFromPDFClient } from "./pdf-extract-client";

type AppContextType = {
  documentA: DocumentInfo;
  setDocumentA: (doc: DocumentInfo) => void;
  documentB: DocumentInfo;
  setDocumentB: (doc: DocumentInfo) => void;
  overlayDocument: DocumentInfo;
  setOverlayDocument: (doc: DocumentInfo) => void;
  isExtracting: boolean;
  extractionProgress: number;
  extractionTarget: "A" | "B" | "C" | null;
  comparisonResult: ComparisonResult | null;
  isComparing: boolean;
  comparisonProgress: number;
  newfiBaselineText: string;
  setNewfiBaselineText: (text: string) => void;
  activePage: "upload" | "compare" | "chat";
  setActivePage: (page: "upload" | "compare" | "chat") => void;
  extractDocument: (doc: "A" | "B" | "C") => Promise<ExtractionResult | null>;
  extractBothDocuments: () => Promise<void>;
  runComparison: () => Promise<void>;
  clearDocuments: () => void;
  exportGuidelinesCSV: (doc: "A" | "B") => void;
  exportComparisonCSV: (type: "full" | "conflicts") => void;
  exportGuidelinesExcel: (doc: "A" | "B") => Promise<void>;
  exportComparisonExcel: () => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

const initialDocumentInfo: DocumentInfo = {
  file: null,
  name: "",
  size: 0,
  uploaded: false,
  extracting: false,
  extracted: false,
  guidelines: [],
  pageCount: 0,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [documentA, setDocumentA] = useState<DocumentInfo>(initialDocumentInfo);
  const [documentB, setDocumentB] = useState<DocumentInfo>({
    ...initialDocumentInfo,
    name: "Newfi Baseline",
  });
  const [overlayDocument, setOverlayDocument] = useState<DocumentInfo>({
    ...initialDocumentInfo,
    name: "Newfi Overlays",
  });
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionTarget, setExtractionTarget] = useState<"A" | "B" | "C" | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonProgress, setComparisonProgress] = useState(0);
  const [newfiBaselineText, setNewfiBaselineText] = useState("");
  const [activePage, setActivePage] = useState<"upload" | "compare" | "chat">("upload");

  // Ref for smooth progress animation
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetProgressRef = useRef(0);

  // Smooth progress animation helper
  const animateProgress = useCallback((setProgress: (val: number) => void, target: number, duration: number = 300) => {
    const start = Date.now();
    const startValue = targetProgressRef.current;

    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (target - startValue) * eased);
      setProgress(current);
      targetProgressRef.current = current;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, []);

  // Simulate incremental progress for smooth UX during API calls
  const startProgressSimulation = useCallback((setProgress: (val: number) => void) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    targetProgressRef.current = 0;

    progressIntervalRef.current = setInterval(() => {
      targetProgressRef.current = Math.min(targetProgressRef.current + Math.random() * 8 + 2, 85);
      setProgress(Math.round(targetProgressRef.current));
    }, 200);
  }, []);

  const stopProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const extractDocument = useCallback(
    async (doc: "A" | "B" | "C"): Promise<ExtractionResult | null> => {
      const document = doc === "A" ? documentA : doc === "B" ? documentB : overlayDocument;
      const setDocument = doc === "A" ? setDocumentA : doc === "B" ? setDocumentB : setOverlayDocument;

      if (!document.file) return null;

      setIsExtracting(true);
      setExtractionTarget(doc);
      setExtractionProgress(0);
      targetProgressRef.current = 0;

      setDocument((prev) => ({ ...prev, extracting: true, error: undefined }));

      // Start smooth progress simulation
      startProgressSimulation(setExtractionProgress);

      try {
        let result: ExtractionResult | null = null;
        let clientError: string | null = null;
        let geminiError: string | null = null;

        // Priority 1: Fast client-side PDF extraction (no AI, no server)
        try {
          const clientResult = await extractGuidelinesFromPDFClient(document.file, doc);
          if (clientResult.success && clientResult.guidelines.length > 0) {
            result = {
              success: true,
              guidelines: clientResult.guidelines,
              fileName: document.file.name,
              pageCount: clientResult.pageCount,
              fileSize: document.file.size,
              extractedAt: new Date().toISOString(),
            };
          } else if (!clientResult.success) {
            clientError = clientResult.error || "Client extraction returned no guidelines";
            console.warn("Client extraction failed:", clientError);
          }
        } catch (err) {
          clientError = err instanceof Error ? err.message : "Unknown client extraction error";
          console.warn("Client PDF extraction failed:", clientError);
        }

        // Priority 2: Gemini AI extraction (smarter, but requires API key)
        // Only try Gemini if client extraction completely failed (no result at all)
        // If client extraction returned fallback data, we keep that
        let geminiResult: ExtractionResult | null = null;
        if (!result) {
          const apiKey = getGeminiApiKey();
          if (apiKey) {
            try {
              geminiResult = await extractWithGemini(document.file, doc);
              if (geminiResult.success) {
                result = geminiResult;
              } else {
                geminiError = geminiResult.error || "Gemini extraction failed";
              }
            } catch (err) {
              geminiError = err instanceof Error ? err.message : "Unknown Gemini error";
              console.warn("Gemini extraction failed:", geminiError);
            }
          } else {
            geminiError = "Gemini API key not configured. Add it in Settings or set NEXT_PUBLIC_GEMINI_API_KEY.";
          }
        }

        // If all methods failed, produce a clear error message
        if (!result || !result.success) {
          let errorMessage = "PDF extraction failed.";
          if (clientError?.includes("Worker")) {
            errorMessage = "PDF processing library failed to load. Please check your internet connection and try again.";
          } else if (clientError?.includes("network")) {
            errorMessage = "Network issue detected. The PDF worker could not be loaded from the CDN.";
          } else if (clientError) {
            errorMessage = `${clientError}`;
          } else if (geminiError?.includes("API key")) {
            errorMessage = "PDF extraction requires a Gemini API key. Add one in Settings, or ensure you have a good internet connection for client-side extraction.";
          } else if (geminiError) {
            errorMessage = `AI extraction failed: ${geminiError}`;
          } else if (result?.error) {
            errorMessage = result.error;
          } else {
            errorMessage = "Could not extract guidelines from this PDF. It may be a scanned image-based PDF or encrypted.";
          }
          result = {
            success: false,
            guidelines: [],
            fileName: document.file.name,
            pageCount: 0,
            fileSize: document.file.size,
            extractedAt: new Date().toISOString(),
            error: errorMessage,
          };
        }

        // Stop simulation and complete progress smoothly
        stopProgressSimulation();

        // Animate to 95%
        await new Promise<void>((resolve) => {
          animateProgress(setExtractionProgress, 95, 400);
          setTimeout(resolve, 400);
        });

        if (result.success) {
          setDocument((prev) => ({
            ...prev,
            extracted: true,
            extracting: false,
            error: undefined,
            guidelines: result.guidelines,
            pageCount: result.pageCount,
          }));
        } else {
          const errorMsg = result.error || "Extraction failed";
          setDocument((prev) => ({
            ...prev,
            extracted: false,
            extracting: false,
            error: errorMsg,
            guidelines: [],
          }));
          console.warn("Extraction completed with error:", errorMsg);
        }

        // Animate to 100%
        await new Promise<void>((resolve) => {
          animateProgress(setExtractionProgress, 100, 200);
          setTimeout(resolve, 250);
        });

        return result;
      } catch (error) {
        stopProgressSimulation();
        console.error("Extraction error:", error);
        setDocument((prev) => ({ ...prev, extracting: false }));
        return null;
      } finally {
        setIsExtracting(false);
        setExtractionTarget(null);
        setTimeout(() => {
          setExtractionProgress(0);
          targetProgressRef.current = 0;
        }, 300);
      }
    },
    [documentA, documentB, overlayDocument, startProgressSimulation, stopProgressSimulation, animateProgress]
  );

  const extractBothDocuments = useCallback(async () => {
    if (documentA.file && !documentA.extracted) {
      await extractDocument("A");
    }
    if (documentB.file && !documentB.extracted) {
      await extractDocument("B");
    }
  }, [documentA, documentB, extractDocument]);

  const runComparison = useCallback(async () => {
    if (!documentA.extracted || !documentB.extracted) return;

    setIsComparing(true);
    setComparisonProgress(0);
    targetProgressRef.current = 0;

    try {
      // Apply overlay adjustments to baseline guidelines if overlay is provided
      let baselineGuidelines = documentB.guidelines;
      if (overlayDocument.extracted && overlayDocument.guidelines.length > 0) {
        // Merge overlay guidelines into baseline: adjust matching guidelines
        const overlayCategories = new Set(overlayDocument.guidelines.map(g => g.category.toLowerCase()));
        // Replace baseline guidelines in categories covered by overlays
        baselineGuidelines = baselineGuidelines.map(bg => {
          if (overlayCategories.has(bg.category.toLowerCase())) {
            // Find the best matching overlay guideline
            const overlayMatch = overlayDocument.guidelines.find(og =>
              og.category.toLowerCase() === bg.category.toLowerCase()
            );
            if (overlayMatch) {
              // Overlay takes precedence
              return {
                ...bg,
                guideline: `${bg.guideline}\n[Overlay Adjustment]: ${overlayMatch.guideline}`,
              };
            }
          }
          return bg;
        });
      }

      const result = await batchCompareGuidelines(
        documentA.guidelines,
        baselineGuidelines,
        (current, total) => {
          const progress = Math.round((current / total) * 100);
          targetProgressRef.current = progress;
          setComparisonProgress(progress);
        }
      );

      setComparisonResult(result);
    } catch (error) {
      console.error("Comparison error:", error);
    } finally {
      setIsComparing(false);
      targetProgressRef.current = 0;
    }
  }, [documentA, documentB, overlayDocument]);

  const clearDocuments = useCallback(() => {
    setDocumentA(initialDocumentInfo);
    setDocumentB({ ...initialDocumentInfo, name: "Newfi Baseline" });
    setOverlayDocument({ ...initialDocumentInfo, name: "Newfi Overlays" });
    setComparisonResult(null);
    setNewfiBaselineText("");
  }, []);

  const exportGuidelinesCSV = useCallback((doc: "A" | "B") => {
    const docInfo = doc === "A" ? documentA : documentB;
    if (docInfo.guidelines.length === 0) return;

    const headers = ["ID", "Category", "Guideline Text", "Severity", "Source Document", "Page Reference"];
    const rows = docInfo.guidelines.map((g) => {
      const pageRef = g.page_reference ||
                     (g.pages && g.pages.length > 0
                       ? g.pages.sort((a, b) => a - b).join(", ")
                       : "N/A");
      return [
        g.id,
        g.category,
        `"${g.guideline.replace(/"/g, '""')}"`,
        g.severity,
        g.sourceDocument || doc,
        pageRef,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = `${docInfo.name.replace(/\.[^/.]+$/, "")}_guidelines.csv`;
    globalThis.document.body.appendChild(link);
    link.click();
    globalThis.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [documentA, documentB]);

  const exportComparisonCSV = useCallback((type: "full" | "conflicts") => {
    if (!comparisonResult) return;

    const comparisons =
      type === "conflicts"
        ? comparisonResult.comparisons.filter((c) => c.verdict === "Conflict")
        : comparisonResult.comparisons;

    const headers = ["#", "Category", "Newfi Guideline", "Seller Guideline", "Findings", "Confidence%", "Reason", "Verbatim Quote", "Page(s)"];
    const rows = comparisons.map((c, i) => {
      const pageRef = c.sellerGuideline?.page_reference ||
                     (c.sellerGuideline?.pages && c.sellerGuideline.pages.length > 0
                       ? c.sellerGuideline.pages.sort((a, b) => a - b).join(", ")
                       : "N/A");
      return [
        i + 1,
        c.newfiGuideline.category,
        `"${c.newfiGuideline.guideline.replace(/"/g, '""')}"`,
        c.sellerGuideline ? `"${c.sellerGuideline.guideline.replace(/"/g, '""')}"` : "Not addressed",
        c.verdict,
        c.confidence,
        `"${c.reason.replace(/"/g, '""')}"`,
        `"${c.verbatimQuote.replace(/"/g, '""')}"`,
        pageRef,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = `comparison_${type}_report.csv`;
    globalThis.document.body.appendChild(link);
    link.click();
    globalThis.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [comparisonResult]);

  const exportGuidelinesExcel = useCallback(async (doc: "A" | "B") => {
    const docInfo = doc === "A" ? documentA : documentB;
    if (docInfo.guidelines.length === 0) return;

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Guidelines");

    // Define colors
    const darkBlue = { argb: "1F4E78" };
    const lightBlue = { argb: "D6DCE5" };
    const whiteFont = { argb: "FFFFFF" };

    // Set column widths
    sheet.getColumn("A").width = 15;
    sheet.getColumn("B").width = 55;
    sheet.getColumn("C").width = 15;
    sheet.getColumn("D").width = 12;
    sheet.getColumn("E").width = 15;

    // Header row
    const headerRow = sheet.getRow(1);
    headerRow.height = 25;
    headerRow.values = ["Category", "Guideline Text", "Severity", "ID", "Page(s)"];

    ["A1", "B1", "C1", "D1", "E1"].forEach((cellRef) => {
      const cell = sheet.getCell(cellRef);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: darkBlue };
      cell.font = { bold: true, color: whiteFont, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } },
      };
    });

    // Group by category
    const groupedByCategory = new Map<string, ExtractedGuideline[]>();
    docInfo.guidelines.forEach((g) => {
      if (!groupedByCategory.has(g.category)) {
        groupedByCategory.set(g.category, []);
      }
      groupedByCategory.get(g.category)!.push(g);
    });

    // Add data rows
    let currentRow = 2;
    const categories = Array.from(groupedByCategory.keys()).sort();

    categories.forEach((category) => {
      const guidelines = groupedByCategory.get(category)!;
      const categoryStartRow = currentRow;

      guidelines.forEach((g, idx) => {
        const row = sheet.getRow(currentRow);
        row.height = 40;

        // Category column
        const cellA = row.getCell(1);
        if (idx === 0) {
          cellA.value = category.toUpperCase();
          cellA.font = { bold: true, size: 10 };
        }
        cellA.fill = { type: "pattern", pattern: "solid", fgColor: lightBlue };
        cellA.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cellA.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Guideline text
        const cellB = row.getCell(2);
        cellB.value = g.guideline;
        cellB.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cellB.font = { size: 9 };
        cellB.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Severity
        const cellC = row.getCell(3);
        cellC.value = g.severity;
        cellC.alignment = { horizontal: "center", vertical: "middle" };
        cellC.font = { size: 9 };
        cellC.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // ID
        const cellD = row.getCell(4);
        cellD.value = g.id;
        cellD.alignment = { horizontal: "center", vertical: "middle" };
        cellD.font = { size: 8 };
        cellD.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        // Page Reference
        const cellE = row.getCell(5);
        const pageRef = g.page_reference ||
                       (g.pages && g.pages.length > 0
                         ? g.pages.sort((a, b) => a - b).join(", ")
                         : "N/A");
        cellE.value = pageRef;
        cellE.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cellE.font = { size: 9 };
        cellE.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } },
        };

        currentRow++;
      });

      // Merge category cells
      if (guidelines.length > 1) {
        sheet.mergeCells(categoryStartRow, 1, currentRow - 1, 1);
      }
    });

    // Freeze panes
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = `${docInfo.name.replace(/\.[^/.]+$/, "")}_guidelines.xlsx`;
    globalThis.document.body.appendChild(link);
    link.click();
    globalThis.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [documentA, documentB]);

  const exportComparisonExcel = useCallback(async () => {
    if (!comparisonResult) return;

    // Use the styled export function
    await exportToExcel(
      documentA.guidelines,
      documentB.guidelines,
      comparisonResult.comparisons,
      "guidelines_comparison_report.xlsx"
    );
  }, [comparisonResult, documentA, documentB]);

  return (
    <AppContext.Provider
      value={{
        documentA,
        setDocumentA,
        documentB,
        setDocumentB,
        overlayDocument,
        setOverlayDocument,
        isExtracting,
        extractionProgress,
        extractionTarget,
        comparisonResult,
        isComparing,
        comparisonProgress,
        newfiBaselineText,
        setNewfiBaselineText,
        activePage,
        setActivePage,
        extractDocument,
        extractBothDocuments,
        runComparison,
        clearDocuments,
        exportGuidelinesCSV,
        exportComparisonCSV,
        exportGuidelinesExcel,
        exportComparisonExcel,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

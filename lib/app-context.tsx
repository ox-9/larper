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
  extractGuidelinesFromPDF,
  batchCompareGuidelines,
  exportToExcel,
} from "./ai-provider";

type AppContextType = {
  documentA: DocumentInfo;
  setDocumentA: (doc: DocumentInfo) => void;
  documentB: DocumentInfo;
  setDocumentB: (doc: DocumentInfo) => void;
  isExtracting: boolean;
  extractionProgress: number;
  extractionTarget: "A" | "B" | null;
  comparisonResult: ComparisonResult | null;
  isComparing: boolean;
  comparisonProgress: number;
  newfiBaselineText: string;
  setNewfiBaselineText: (text: string) => void;
  activePage: "upload" | "compare" | "chat";
  setActivePage: (page: "upload" | "compare" | "chat") => void;
  extractDocument: (doc: "A" | "B") => Promise<ExtractionResult | null>;
  extractBothDocuments: () => Promise<void>;
  runComparison: () => Promise<void>;
  clearDocuments: () => void;
  exportGuidelinesCSV: (doc: "A" | "B") => void;
  exportComparisonCSV: (type: "full" | "critical") => void;
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
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionTarget, setExtractionTarget] = useState<"A" | "B" | null>(null);
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
    async (doc: "A" | "B"): Promise<ExtractionResult | null> => {
      const document = doc === "A" ? documentA : documentB;
      const setDocument = doc === "A" ? setDocumentA : setDocumentB;

      if (!document.file) return null;

      setIsExtracting(true);
      setExtractionTarget(doc);
      setExtractionProgress(0);
      targetProgressRef.current = 0;

      setDocument((prev) => ({ ...prev, extracting: true }));

      // Start smooth progress simulation
      startProgressSimulation(setExtractionProgress);

      try {
        const result = await extractGuidelinesFromPDF(document.file, doc);

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
            guidelines: result.guidelines,
            pageCount: result.pageCount,
          }));
        } else {
          setDocument((prev) => ({
            ...prev,
            extracting: false,
          }));
          console.error("Extraction failed:", result.error);
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
    [documentA, documentB, startProgressSimulation, stopProgressSimulation, animateProgress]
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
      const result = await batchCompareGuidelines(
        documentA.guidelines,
        documentB.guidelines,
        (current, total) => {
          const progress = Math.round((current / total) * 100);
          // Smooth progress updates during comparison
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
  }, [documentA, documentB]);

  const clearDocuments = useCallback(() => {
    setDocumentA(initialDocumentInfo);
    setDocumentB({ ...initialDocumentInfo, name: "Newfi Baseline" });
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

  const exportComparisonCSV = useCallback((type: "full" | "critical") => {
    if (!comparisonResult) return;

    const comparisons =
      type === "critical"
        ? comparisonResult.comparisons.filter((c) => c.verdict === "NO_GO")
        : comparisonResult.comparisons;

    const headers = ["#", "Category", "Guideline", "Source", "Verdict", "Confidence%", "Reason", "Conflicting Rule", "Page Reference"];
    const rows = comparisons.map((c, i) => {
      const pageRef = c.sellerGuideline.page_reference ||
                     (c.sellerGuideline.pages && c.sellerGuideline.pages.length > 0
                       ? c.sellerGuideline.pages.sort((a, b) => a - b).join(", ")
                       : "N/A");
      return [
        i + 1,
        c.sellerGuideline.category,
        `"${c.sellerGuideline.guideline.replace(/"/g, '""')}"`,
        c.sellerGuideline.sourceDocument || "A",
        c.verdict,
        c.confidence,
        `"${c.reason.replace(/"/g, '""')}"`,
        c.conflictingNewfiRule ? `"${c.conflictingNewfiRule.replace(/"/g, '""')}"` : "N/A",
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

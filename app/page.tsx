"use client";

import { useState, useCallback, useEffect } from "react";
import { DocumentUploadCard } from "@/components/DocumentUploadCard";
import { GuidelineList } from "@/components/GuidelineList";
import { GuidelineSkeleton } from "@/components/GuidelineSkeleton";
import { LarpGPT } from "@/components/LarpGPT";
import { NewfiBaselinePanel } from "@/components/NewfiBaselinePanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useApp } from "@/lib/app-context";

export default function Home() {
  const {
    documentA, setDocumentA,
    documentB, setDocumentB,
    isExtracting, extractionProgress, extractionTarget,
    comparisonResult, isComparing, comparisonProgress,
    activePage, setActivePage,
    extractDocument, runComparison,
    exportGuidelinesCSV, exportComparisonCSV,
    exportGuidelinesExcel, exportComparisonExcel,
  } = useApp();

  const [showBaselinePanel, setShowBaselinePanel] = useState(false);

  const handleFileSelectA = useCallback((file: File) => {
    setDocumentA({ file, name: file.name, size: file.size, uploaded: true, extracting: false, extracted: false, guidelines: [], pageCount: 0 });
  }, [setDocumentA]);

  const handleFileSelectB = useCallback((file: File) => {
    setDocumentB({ file, name: file.name, size: file.size, uploaded: true, extracting: false, extracted: false, guidelines: [], pageCount: 0 });
  }, [setDocumentB]);

  const handleClearA = useCallback(() => {
    setDocumentA({ file: null, name: "", size: 0, uploaded: false, extracting: false, extracted: false, guidelines: [], pageCount: 0 });
  }, [setDocumentA]);

  const handleClearB = useCallback(() => {
    setDocumentB({ file: null, name: "", size: 0, uploaded: false, extracting: false, extracted: false, guidelines: [], pageCount: 0 });
  }, [setDocumentB]);

  const canCompare = documentA.extracted && documentB.extracted;
  const totalGuidelines = documentA.guidelines.length + documentB.guidelines.length;

  const navItems = [
    { key: "upload" as const, label: "Upload", icon: (
      <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    )},
    { key: "compare" as const, label: "Compare", icon: (
      <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    )},
    { key: "chat" as const, label: "LarpGPT", icon: (
      <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-[#eef2f6] dark:bg-[#0a0a0c] transition-colors duration-300">
      {/* Ambient gradient background */}
      <div className="ambient-gradient" />

      {/* Grid pattern */}
      <div className="grid-pattern" />

      {/* Animated gradient orbs */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />

      {/* ===== NAVBAR ===== */}
      <nav className="sticky top-0 z-50">
        <div className="mx-auto px-6">
          <div className="liquid-glass-strong mt-4 mx-4 px-6 card-lift">
            <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-[#0A84FF] via-[#5E5CE6] to-[#BF5AF2] flex items-center justify-center animate-pulse-glow">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-semibold text-[15px] tracking-tight gradient-text">NewFI</span>
                  <span className="text-slate-600 dark:text-[rgba(255,255,255,0.65)] font-medium text-[13px] tracking-tight">Guideline Processor</span>
                </div>
              </div>

              {/* Navigation Pill */}
              <div className="liquid-glass flex items-center gap-1 p-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActivePage(item.key)}
                    className={`flex items-center gap-2 px-4 py-[7px] rounded-[9px] text-[13px] font-medium transition-all duration-200 ${
                      activePage === item.key
                        ? 'bg-[rgba(255,255,255,0.12)] text-white shadow-lg'
                        : 'text-slate-500 dark:text-[rgba(255,255,255,0.5)] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[rgba(255,255,255,0.06)]'
                    }`}
                  >
                    {item.icon}
                    <span className="font-display">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBaselinePanel(!showBaselinePanel)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-200 ${
                    showBaselinePanel
                      ? 'liquid-glass bg-[rgba(48,209,88,0.2)] text-[#30D158] shadow-lg'
                      : 'liquid-glass-card text-slate-500 dark:text-[rgba(255,255,255,0.55)] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <svg className="w-[15px] h-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
                  </svg>
                  <span className="font-display">Baseline</span>
                </button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== MAIN ===== */}
      <main className="relative max-w-6xl mx-auto px-4 py-6 z-10">

        {/* Hero - Enhanced with animated gradient */}
        {activePage === "upload" && !documentA.uploaded && !documentB.uploaded && (
          <div className="text-center mb-12 animate-fade-in pt-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-float">
              <div className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
              <span className="text-[11px] font-medium text-slate-700 dark:text-[rgba(255,255,255,0.7)] tracking-wide uppercase">AI-Powered Mortgage Compliance</span>
            </div>
            <h1 className="font-display text-[48px] font-bold tracking-tight mb-5 text-white leading-tight">
              <span className="gradient-text-animated">NewFI Guideline</span>
              <br />
              <span className="text-slate-900 dark:text-[rgba(255,255,255,0.9)]">Processor</span>
            </h1>
            <p className="text-[17px] text-slate-500 dark:text-[rgba(255,255,255,0.5)] max-w-xl mx-auto leading-relaxed font-display">
              Extract, compare, and analyze mortgage guidelines against NewFI underwriting standards with AI precision.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {['PDF Extraction', 'Compliance Analysis', 'Guideline Comparison'].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full liquid-glass-card text-[13px] text-slate-600 dark:text-[rgba(255,255,255,0.6)]">
                  <svg className="w-4 h-4 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats - Enhanced with card lift effects */}
        {activePage === "upload" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard value={totalGuidelines} label="Guidelines" colors={['#0A84FF', '#64D2FF']} icon="document" delay="stagger-1" />
            <StatCard value={documentA.extracted ? 1 : 0} label="Seller Guides" colors={['#FF3B30', '#FF9F0A']} icon="upload" delay="stagger-2" />
            <StatCard value={documentB.extracted ? 1 : 0} label="Baselines" colors={['#30D158', '#34C759']} icon="check" delay="stagger-3" />
            <StatCard value={comparisonResult?.complianceScore ?? 0} label="Compliance Score" suffix="%" colors={['#FFD60A', '#FF9F0A']} icon="chart" delay="stagger-4" />
          </div>
        )}

        {/* Upload Page */}
        {activePage === "upload" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <DocumentUploadCard
                document={documentA}
                documentType="A"
                onFileSelect={handleFileSelectA}
                onExtract={() => extractDocument("A")}
                onClear={handleClearA}
                isExtracting={isExtracting}
                extractionProgress={extractionTarget === "A" ? extractionProgress : 0}
                isTarget={extractionTarget === "A"}
              />
              {documentA.extracted && documentA.guidelines.length > 0 && (
                <GuidelineList guidelines={documentA.guidelines} documentType="A" onExportCSV={() => exportGuidelinesCSV("A")} onExportExcel={() => exportGuidelinesExcel("A")} />
              )}
              {isExtracting && extractionTarget === "A" && !documentA.extracted && <GuidelineSkeleton count={5} />}
            </div>
            <div className="space-y-5">
              <DocumentUploadCard
                document={documentB}
                documentType="B"
                onFileSelect={handleFileSelectB}
                onExtract={() => extractDocument("B")}
                onClear={handleClearB}
                isExtracting={isExtracting}
                extractionProgress={extractionTarget === "B" ? extractionProgress : 0}
                isTarget={extractionTarget === "B"}
              />
              {documentB.extracted && documentB.guidelines.length > 0 && (
                <GuidelineList guidelines={documentB.guidelines} documentType="B" onExportCSV={() => exportGuidelinesCSV("B")} onExportExcel={() => exportGuidelinesExcel("B")} />
              )}
              {isExtracting && extractionTarget === "B" && !documentB.extracted && <GuidelineSkeleton count={5} />}
            </div>
          </div>
        )}

        {/* Compare Page */}
        {activePage === "compare" && (
          <ComparisonView
            canCompare={canCompare}
            comparisonResult={comparisonResult}
            isComparing={isComparing}
            comparisonProgress={comparisonProgress}
            onRunComparison={runComparison}
            onExportCSV={exportComparisonCSV}
            onExportExcel={exportComparisonExcel}
          />
        )}

        {/* Chat Page */}
        {activePage === "chat" && (
          <div className="liquid-glass-strong animate-fade-in card-lift">
            <LarpGPT
              documentContext={documentA.extracted ? documentA.name : undefined}
              guidelinesContext={documentB.extracted ? documentB.guidelines.map((g) => `${g.category}: ${g.guideline}`).join("\n") : undefined}
            />
          </div>
        )}

        {/* Tips - Enhanced */}
        {activePage === "upload" && !documentA.uploaded && !documentB.uploaded && (
          <div className="mt-10 liquid-glass-strong p-6 animate-fade-in animate-scale-in stagger-3">
            <h3 className="font-display font-semibold text-[15px] text-white mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Getting Started
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { text: "Upload your seller guide PDF to Document A", icon: "📄" },
                { text: "Upload NewFI's baseline guidelines to Document B", icon: "📋" },
                { text: "Use Compare tab to run AI compliance check", icon: "🔍" },
                { text: "Use LarpGPT for mortgage guideline questions", icon: "💬" },
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-[12px] liquid-glass-card group cursor-pointer hover:bg-[rgba(255,255,255,0.08)] transition-all">
                  <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#0A84FF]/20 to-[#5E5CE6]/20 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                    {tip.icon}
                  </div>
                  <span className="text-[14px] text-slate-700 dark:text-[rgba(255,255,255,0.7)]">{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer - Enhanced */}
        <footer className="mt-12 pt-6 border-t border-[rgba(255,255,255,0.06)]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-slate-400 dark:text-[rgba(255,255,255,0.35)]">
            <div className="flex items-center gap-4">
              <span>Powered by <span className="gradient-text font-medium">Claude AI</span></span>
              <span className="w-1 h-1 rounded-full bg-[rgba(255,255,255,0.2)]" />
              <span className="font-mono">{totalGuidelines} guidelines processed</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
              <span className="font-display text-slate-500 dark:text-[rgba(255,255,255,0.5)]">System Ready</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Baseline Panel */}
      {showBaselinePanel && (
        <div className="fixed right-5 top-24 z-50 animate-slide-in-right">
          <NewfiBaselinePanel
            baselineText=""
            onBaselineTextChange={() => {}}
            guidelines={documentB.guidelines}
            onImportFromPDF={() => {}}
            isCollapsed={false}
            onToggle={() => setShowBaselinePanel(false)}
          />
        </div>
      )}

    </div>
  );
}

/* ===== Stat Card - Enhanced with icons and animations ===== */
function StatCard({ value, label, suffix = "", colors, icon, delay }: { value: number; label: string; suffix?: string; colors: string[]; icon: string; delay?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const duration = 600;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  const iconPaths: Record<string, string> = {
    document: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z",
    upload: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5",
    check: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  };

  return (
    <div className={`liquid-glass-card p-5 card-lift group animate-fade-in ${delay || ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-[11px] flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${colors[0]}20 0%, ${colors[1]}20 100%)` }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: colors[0] }}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[icon]} />
          </svg>
        </div>
        <div className="w-2 h-2 rounded-full" style={{ background: colors[0], opacity: 0.5 }} />
      </div>
      <p className="text-[32px] font-display font-bold font-mono leading-none mb-2" style={{ color: colors[0] }}>
        {displayValue}{suffix}
      </p>
      <p className="text-[12px] text-slate-500 dark:text-[rgba(255,255,255,0.45)] font-display uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ===== Comparison View - Enhanced ===== */
function ComparisonView({ canCompare, comparisonResult, isComparing, comparisonProgress, onRunComparison, onExportCSV, onExportExcel }: {
  canCompare: boolean;
  comparisonResult: ReturnType<typeof useApp>["comparisonResult"];
  isComparing: boolean;
  comparisonProgress: number;
  onRunComparison: () => void;
  onExportCSV: (type: "full" | "critical") => void;
  onExportExcel: () => void;
}) {
  if (!canCompare) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl liquid-glass flex items-center justify-center animate-float">
          <svg className="w-12 h-12 text-slate-400 dark:text-[rgba(255,255,255,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-white mb-3">Documents Required</h2>
        <p className="text-[15px] text-slate-500 dark:text-[rgba(255,255,255,0.45)] max-w-md mx-auto">Upload and extract both seller guide and baseline documents to run compliance comparison</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {comparisonResult && (
        <div className="liquid-glass-strong p-8">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <ScoreRing score={comparisonResult.complianceScore} verdict={comparisonResult.overallVerdict} />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-[#0A84FF]/20 to-[#5E5CE6]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="font-display text-[19px] font-semibold text-white">Compliance Summary</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="liquid-glass p-4 rounded-[14px] border border-[rgba(48,209,88,0.2)] group hover:border-[rgba(48,209,88,0.4)] transition-colors">
                  <p className="text-[28px] font-display font-bold text-[#30D158] font-mono group-hover:scale-110 transition-transform origin-left">{comparisonResult.goCount}</p>
                  <p className="text-[11px] text-[#30D158] opacity-80 font-display uppercase tracking-wider">Compliant</p>
                </div>
                <div className="liquid-glass p-4 rounded-[14px] border border-[rgba(255,59,48,0.2)] group hover:border-[rgba(255,59,48,0.4)] transition-colors">
                  <p className="text-[28px] font-display font-bold text-[#FF453A] font-mono group-hover:scale-110 transition-transform origin-left">{comparisonResult.noGoCount}</p>
                  <p className="text-[11px] text-[#FF453A] opacity-80 font-display uppercase tracking-wider">Non-Compliant</p>
                </div>
                <div className="liquid-glass p-4 rounded-[14px] border border-[rgba(255,159,10,0.2)] group hover:border-[rgba(255,159,10,0.4)] transition-colors">
                  <p className="text-[28px] font-display font-bold text-[#FF9F0A] font-mono group-hover:scale-110 transition-transform origin-left">{comparisonResult.reviewCount}</p>
                  <p className="text-[11px] text-[#FF9F0A] opacity-80 font-display uppercase tracking-wider">Review</p>
                </div>
              </div>
              <div className={`p-4 rounded-[14px] ${
                comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "bg-[rgba(48,209,88,0.12)] border border-[rgba(48,209,88,0.25)]"
                : comparisonResult.overallVerdict === "NON_COMPLIANT" ? "bg-[rgba(255,59,48,0.12)] border border-[rgba(255,59,48,0.25)]"
                : "bg-[rgba(255,159,10,0.12)] border border-[rgba(255,159,10,0.25)]"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "bg-[#30D158]"
                    : comparisonResult.overallVerdict === "NON_COMPLIANT" ? "bg-[#FF453A]"
                    : "bg-[#FF9F0A]"
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className={`font-display font-semibold text-[15px] ${
                    comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "text-[#30D158]"
                    : comparisonResult.overallVerdict === "NON_COMPLIANT" ? "text-[#FF453A]"
                    : "text-[#FF9F0A]"
                  }`}>
                    {comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "Fully Compliant"
                    : comparisonResult.overallVerdict === "NON_COMPLIANT" ? "Non-Compliant"
                    : "Review Required"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isComparing && (
        <div className="liquid-glass p-6">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-full liquid-glass flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-[#0A84FF] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-display font-medium text-[16px] text-white mb-1">Analyzing Compliance...</p>
              <p className="text-[14px] text-slate-500 dark:text-[rgba(255,255,255,0.45)] font-mono">{comparisonProgress}% complete</p>
            </div>
          </div>
          <div className="mt-5 progress-container h-2 rounded-full">
            <div className="progress-bar rounded-full" style={{ width: `${comparisonProgress}%` }} />
          </div>
        </div>
      )}

      {!comparisonResult && !isComparing && (
        <div className="flex justify-center py-10">
          <button
            onClick={onRunComparison}
            className="group px-10 py-4 rounded-[16px] bg-gradient-to-b from-[#0A84FF] to-[#0066CC] text-white font-display font-semibold text-[16px] transition-all hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(10,132,255,0.4)] active:scale-[0.98] flex items-center gap-3"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Run Compliance Comparison
          </button>
        </div>
      )}

      {comparisonResult && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onExportCSV("full")} className="flex items-center gap-2 px-5 py-3 rounded-[12px] bg-[#0A84FF] text-white text-[14px] font-medium hover:opacity-90 transition-all hover:shadow-[0_4px_16px_rgba(10,132,255,0.3)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
          <button onClick={onExportExcel} className="flex items-center gap-2 px-5 py-3 rounded-[12px] liquid-glass-card text-[#30D158] text-[14px] font-medium hover:bg-[rgba(48,209,88,0.1)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Export Excel
          </button>
          <button onClick={() => onExportCSV("critical")} className="flex items-center gap-2 px-5 py-3 rounded-[12px] liquid-glass-card text-[#FF453A] text-[14px] font-medium hover:bg-[rgba(255,69,58,0.1)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Critical Only
          </button>
        </div>
      )}

      {comparisonResult && <ComparisonResults comparisons={comparisonResult.comparisons} />}
    </div>
  );
}

function ScoreRing({ score, verdict }: { score: number; verdict: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    const duration = 800;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setAnimatedScore(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  const circumference = 2 * Math.PI * 42;
  const progress = (animatedScore / 100) * circumference;
  const color = verdict === "FULLY_COMPLIANT" ? "#30D158" : verdict === "NON_COMPLIANT" ? "#FF453A" : "#FF9F0A";

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-display font-bold text-white font-mono">{animatedScore}</span>
        <span className="text-[11px] text-slate-500 dark:text-[rgba(255,255,255,0.45)] font-display uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

function ComparisonResults({ comparisons }: { comparisons: any[] }) {
  const [filter, setFilter] = useState<"all" | "GO" | "NO_GO" | "REVIEW">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered = filter === "all" ? comparisons : comparisons.filter((c) => c.verdict === filter);

  const config: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    GO: { bg: "bg-[rgba(48,209,88,0.12)]", text: "text-[#30D158]", icon: "✓", label: "Compliant" },
    NO_GO: { bg: "bg-[rgba(255,59,48,0.12)]", text: "text-[#FF453A]", icon: "✕", label: "Non-Compliant" },
    REVIEW: { bg: "bg-[rgba(255,159,10,0.12)]", text: "text-[#FF9F0A]", icon: "!", label: "Review" },
  };

  return (
    <div className="liquid-glass-strong overflow-hidden">
      <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex flex-wrap gap-2">
        {(["all", "GO", "NO_GO", "REVIEW"] as const).map((f) => {
          const count = f === "all" ? comparisons.length : comparisons.filter((c) => c.verdict === f).length;
          const activeColor = f === "GO" ? "#30D158" : f === "NO_GO" ? "#FF453A" : f === "REVIEW" ? "#FF9F0A" : "#0A84FF";
          return (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
              filter === f ? "text-white shadow-lg" : "text-slate-500 dark:text-[rgba(255,255,255,0.5)] liquid-glass-card hover:text-slate-900 dark:hover:text-white"
            }`} style={filter === f ? { background: activeColor } : {}}>
              {f === "all" ? "All Results" : config[f].label} ({count})
            </button>
          );
        })}
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.04)] max-h-[500px] overflow-y-auto">
        {filtered.map((c, i) => {
          const cfg = config[c.verdict];
          return (
            <div key={c.id} className={`p-5 hover:bg-[rgba(255,255,255,0.02)] cursor-pointer transition-all duration-200 ${c.verdict === "NO_GO" ? "shadow-[inset_3px_0_0_#FF453A]" : ""}`}>
              <div className="flex gap-4">
                <div className="w-24 shrink-0">
                  <div className={`px-3 py-1.5 rounded-[8px] ${cfg.bg} ${cfg.text} text-[12px] font-semibold text-center flex items-center justify-center gap-1`}>
                    <span>{cfg.icon}</span>
                    <span>{c.verdict.replace("_", " ")}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] text-slate-500 dark:text-[rgba(255,255,255,0.4)] font-display uppercase tracking-wider">{c.sellerGuideline.category}</span>
                  <p className="text-[14px] text-slate-800 dark:text-[rgba(255,255,255,0.8)] line-clamp-2 mt-1 leading-relaxed">{c.sellerGuideline.guideline}</p>
                  {expandedId === c.id && (
                    <div className="mt-3 p-3 liquid-glass rounded-[10px] animate-fade-in">
                      <p className="text-[13px] text-slate-600 dark:text-[rgba(255,255,255,0.6)] leading-relaxed">{c.reason}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="p-2 hover:bg-[rgba(255,255,255,0.05)] rounded-[8px] transition-colors self-start">
                  <svg className={`w-5 h-5 text-slate-400 dark:text-[rgba(255,255,255,0.35)] transition-transform duration-300 ${expandedId === c.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

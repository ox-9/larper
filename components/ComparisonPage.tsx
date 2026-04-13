"use client";

import { useState, useEffect } from "react";
import type { GuidelineComparison, ComparisonResult } from "@/lib/types";

type ComparisonPageProps = {
  comparisonResult: ComparisonResult | null;
  isComparing: boolean;
  comparisonProgress: number;
  onExportCSV: (type: "full" | "critical") => void;
  onExportExcel: () => void;
  onRunComparison: () => void;
  hasDocuments: boolean;
};

const verdictConfig = {
  GO: {
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/25",
    textColor: "text-emerald-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    label: "Compliant",
  },
  NO_GO: {
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/25",
    textColor: "text-red-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    label: "Non-Compliant",
  },
  REVIEW: {
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/25",
    textColor: "text-amber-400",
    icon: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    label: "Needs Review",
  },
};

function AnimatedScoreRing({ score, verdict }: { score: number; verdict: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 600;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedScore(Math.round(score * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const circumference = 2 * Math.PI * 45;
  const progress = (animatedScore / 100) * circumference;
  const gradientColors =
    verdict === "FULLY_COMPLIANT" ? ["#10b981", "#22c55e", "#14b8a6"]
    : verdict === "NON_COMPLIANT" ? ["#ef4444", "#f43f5e", "#ec4899"]
    : ["#eab308", "#f59e0b", "#f97316"];

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/[0.06]" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#scoreGradient)" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-300" />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {gradientColors.map((color, i) => (
              <stop key={i} offset={`${(i / (gradientColors.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-heading font-bold text-white tabular-nums">{animatedScore}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Compliance</span>
      </div>
    </div>
  );
}

function GuidelineRow({
  comparison,
  index,
  isExpanded,
  onToggle,
}: {
  comparison: GuidelineComparison;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = verdictConfig[comparison.verdict];

  return (
    <div
      className={`flex gap-4 p-4 border-b border-white/[0.04] transition-all hover:bg-white/[0.02] ${
        comparison.verdict === "NO_GO" ? "shadow-[inset_3px_0_0_#dc2626]" : ""
      } animate-fade-in-up`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Verdict column */}
      <div className="flex-shrink-0 w-28">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${config.bgColor} border ${config.borderColor}`} title={comparison.reason}>
          {config.icon}
          <span className={`text-xs font-medium ${config.textColor}`}>{comparison.verdict}</span>
        </div>
        <div className="mt-1.5 text-center">
          <span className="text-[10px] text-slate-500 tabular-nums">{comparison.confidence}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-300 text-xs font-medium border border-white/[0.06]">
            {comparison.sellerGuideline.category}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.04] text-slate-400 border border-white/[0.06]">
            {comparison.sellerGuideline.severity}
          </span>
        </div>
        <p className="text-sm text-slate-300 line-clamp-2">{comparison.sellerGuideline.guideline}</p>
        {isExpanded && (
          <div className="mt-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-slate-400">{comparison.reason}</p>
            {comparison.conflictingNewfiRule && (
              <p className="text-xs text-red-400 mt-1"><strong>Conflicting Rule:</strong> {comparison.conflictingNewfiRule}</p>
            )}
          </div>
        )}
      </div>

      {/* Expand button */}
      <button onClick={onToggle} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

export function ComparisonPage({
  comparisonResult,
  isComparing,
  comparisonProgress,
  onExportCSV,
  onExportExcel,
  onRunComparison,
  hasDocuments,
}: ComparisonPageProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "GO" | "NO_GO" | "REVIEW">("all");

  if (!hasDocuments) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center animate-fade-in-up">
          <div className="inline-flex p-6 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-5">
            <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
            </svg>
          </div>
          <h2 className="font-heading text-xl font-semibold text-white mb-2">No Documents Uploaded</h2>
          <p className="text-slate-400 text-sm">Upload and extract both documents to run a comparison</p>
        </div>
      </div>
    );
  }

  const filteredComparisons = comparisonResult?.comparisons.filter((c) =>
    filter === "all" ? true : c.verdict === filter
  ) || [];

  return (
    <div className="space-y-6">
      {/* Summary Dashboard */}
      {comparisonResult && (
        <div className="relative overflow-hidden rounded-2xl glass-strong p-6">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 via-blue-500 to-cyan-500" />

          <div className="flex flex-col md:flex-row items-center gap-8">
            <AnimatedScoreRing score={comparisonResult.complianceScore} verdict={comparisonResult.overallVerdict} />
            <div className="flex-1">
              <h2 className="font-heading text-xl font-semibold text-white mb-4">Compliance Summary</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                  <p className="text-2xl font-heading font-bold text-emerald-400 tabular-nums">{comparisonResult.goCount}</p>
                  <p className="text-xs text-emerald-300">Compliant</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
                  <p className="text-2xl font-heading font-bold text-red-400 tabular-nums">{comparisonResult.noGoCount}</p>
                  <p className="text-xs text-red-300">Non-Compliant</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
                  <p className="text-2xl font-heading font-bold text-amber-400 tabular-nums">{comparisonResult.reviewCount}</p>
                  <p className="text-xs text-amber-300">Needs Review</p>
                </div>
              </div>
              <div className={`p-3 rounded-xl ${
                comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "bg-emerald-500/15 border border-emerald-500/25"
                : comparisonResult.overallVerdict === "NON_COMPLIANT" ? "bg-red-500/15 border border-red-500/25"
                : "bg-amber-500/15 border border-amber-500/25"
              }`}>
                <p className={`font-semibold text-sm ${
                  comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "text-emerald-400"
                  : comparisonResult.overallVerdict === "NON_COMPLIANT" ? "text-red-400"
                  : "text-amber-400"
                }`}>
                  {comparisonResult.overallVerdict === "FULLY_COMPLIANT" ? "✓ FULLY COMPLIANT"
                  : comparisonResult.overallVerdict === "NON_COMPLIANT" ? `✗ NON-COMPLIANT — ${comparisonResult.noGoCount} critical issues`
                  : "⚠ REVIEW REQUIRED"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress during comparison */}
      {isComparing && (
        <div className="relative overflow-hidden rounded-2xl glass p-5">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 to-blue-500 animate-shimmer" />
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-[3px] border-white/[0.06]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-brand-500 border-t-transparent animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-heading font-semibold text-white">Analyzing guidelines...</p>
              <p className="text-sm text-slate-400">{comparisonProgress}% complete</p>
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blue-500 transition-all duration-300" style={{ width: `${comparisonProgress}%` }} />
          </div>
        </div>
      )}

      {/* Run comparison button */}
      {!comparisonResult && !isComparing && hasDocuments && (
        <div className="flex justify-center">
          <button
            onClick={onRunComparison}
            className="relative group overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 via-blue-500 to-cyan-500 px-10 py-4 text-base font-heading font-semibold text-white shadow-xl shadow-brand-500/20 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-brand-500/30"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Run Compliance Comparison
            </span>
          </button>
        </div>
      )}

      {/* Export buttons */}
      {comparisonResult && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => onExportCSV("full")} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-blue-500 text-white text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-brand-500/15">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export Full Report (CSV)
          </button>
          <button onClick={onExportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/15 transition-all border border-emerald-500/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" /></svg>
            Export Excel
          </button>
          <button onClick={() => onExportCSV("critical")} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/15 transition-all border border-red-500/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            Critical Issues Only (CSV)
          </button>
        </div>
      )}

      {/* Filter tabs */}
      {comparisonResult && (
        <div className="flex gap-2 flex-wrap">
          {(["all", "GO", "NO_GO", "REVIEW"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? f === "GO" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                  : f === "NO_GO" ? "bg-red-500/15 text-red-300 border border-red-500/25"
                  : f === "REVIEW" ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                  : "bg-gradient-to-r from-brand-500 to-blue-500 text-white shadow-sm"
                  : "bg-white/[0.04] text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
              }`}
            >
              {f === "all" ? "All" : f.replace("_", " ")} ({f === "all" ? comparisonResult.comparisons.length : comparisonResult.comparisons.filter((c) => c.verdict === f).length})
            </button>
          ))}
        </div>
      )}

      {/* Guidelines comparison list */}
      {comparisonResult && (
        <div className="relative overflow-hidden rounded-2xl glass-strong">
          <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
            {filteredComparisons.map((comparison, index) => (
              <GuidelineRow
                key={comparison.id}
                comparison={comparison}
                index={index}
                isExpanded={expandedId === comparison.id}
                onToggle={() => setExpandedId(expandedId === comparison.id ? null : comparison.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
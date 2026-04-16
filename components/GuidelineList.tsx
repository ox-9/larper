"use client";

import { useState } from "react";
import type { ExtractedGuideline } from "@/lib/types";

type GuidelineListProps = {
  guidelines: ExtractedGuideline[];
  documentType: "A" | "B" | "C";
  onExportCSV: () => void;
  onExportExcel: () => void;
};

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#FF453A", bg: "rgba(255,69,58,0.12)", label: "Critical" },
  standard: { color: "#FF9F0A", bg: "rgba(255,159,10,0.12)", label: "Standard" },
  informational: { color: "#0A84FF", bg: "rgba(10,132,255,0.12)", label: "Info" },
};

// Clean up guideline text by removing JSON formatting and escape characters
function cleanGuidelineText(text: string): string {
  if (!text) return "";

  // Check if text contains JSON-like escaped content
  if (text.includes('\\"') || text.includes('\"id\"') || text.includes('\"category\"')) {
    try {
      // Try to extract just the guideline field from JSON
      const guidelineMatch = text.match(/"guideline"[:\s]*"([^"]+)"/);
      if (guidelineMatch && guidelineMatch[1]) {
        return guidelineMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
      }

      // Try to parse as JSON array
      if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
        const parsed = JSON.parse(text.replace(/\\"/g, '"').replace(/\\n/g, '\n'));
        if (Array.isArray(parsed) && parsed[0]?.guideline) {
          return parsed[0].guideline;
        }
        if (parsed?.guideline) {
          return parsed.guideline;
        }
      }
    } catch {
      // If JSON parsing fails, continue with manual cleanup
    }
  }

  // Manual cleanup: remove JSON artifacts and normalize quotes
  return text
    .replace(/\\"/g, '"')      // Remove escaped quotes
    .replace(/\\n/g, ' ')        // Replace newlines with spaces
    .replace(/\\t/g, ' ')        // Replace tabs with spaces
    .replace(/\\/g, '')          // Remove remaining backslashes
    .replace(/\s+/g, ' ')        // Normalize multiple spaces
    .replace(/"id":\s*"[^"]*",?/g, '')     // Remove id fields
    .replace(/"category":\s*"[^"]*",?/g, '') // Remove category fields
    .replace(/"severity":\s*"[^"]*",?/g, '') // Remove severity fields
    .replace(/"page_reference":\s*"[^"]*",?/g, '') // Remove page_reference fields
    .replace(/["{}[\]]/g, '')    // Remove JSON brackets and quotes
    .replace(/guideline:/gi, '')  // Remove "guideline:" label
    .trim();
}

export function GuidelineList({ guidelines, documentType, onExportCSV, onExportExcel }: GuidelineListProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [...new Set(guidelines.map((g) => g.category))];
  const severities = [...new Set(guidelines.map((g) => g.severity))];

  const filteredGuidelines = guidelines.filter((g) => {
    const matchesCategory = selectedCategory ? g.category === selectedCategory : true;
    const matchesSeverity = selectedSeverity ? g.severity === selectedSeverity : true;
    const matchesSearch = searchQuery
      ? g.guideline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.category.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSeverity && matchesSearch;
  });

  const groupedGuidelines = categories.reduce((acc, cat) => {
    acc[cat] = guidelines.filter((g) => g.category === cat);
    return acc;
  }, {} as Record<string, ExtractedGuideline[]>);

  if (guidelines.length === 0) return null;

  const accentColor = documentType === "A" ? "#0A84FF" : documentType === "B" ? "#30D158" : "#FF9F0A";
  const accentSecondary = documentType === "A" ? "#5E5CE6" : documentType === "B" ? "#34C759" : "#FF6B35";

  return (
    <div className="glass-strong animate-fade-in overflow-hidden">
      {/* Header - Enhanced */}
      <div className="p-5 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[13px] font-bold text-white shadow-md"
              style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentSecondary} 100%)` }}
            >
              {documentType}
            </div>
            <div>
              <span className="font-display font-semibold text-[16px] text-slate-900 dark:text-white">Guidelines</span>
              <span className="ml-2 text-[14px] text-slate-500 dark:text-slate-500 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)] font-mono">({filteredGuidelines.length}/{guidelines.length})</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] liquid-glass-card text-[12px] font-display text-slate-600 dark:text-slate-600 dark:text-[rgba(255,255,255,0.7)] hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[rgba(255,255,255,0.1)] transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              CSV
            </button>
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] liquid-glass-card text-[12px] font-display text-[#30D158] hover:bg-[rgba(48,209,88,0.1)] transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Excel
            </button>
          </div>
        </div>

        {/* Search - Enhanced */}
        <div className="relative mb-4">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-400 dark:text-[rgba(255,255,255,0.3)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guidelines..."
            className="w-full pl-11 pr-4 py-3 rounded-[12px] liquid-glass text-[14px] text-white placeholder-[rgba(255,255,255,0.35)] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category Filters - Enhanced */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all ${
              selectedCategory === null
                ? 'text-white shadow-md'
                : 'text-slate-600 dark:text-slate-600 dark:text-[rgba(255,255,255,0.6)] hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white liquid-glass-card'
            }`}
            style={{ background: selectedCategory === null ? accentColor : undefined }}
          >
            All ({guidelines.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all ${
                selectedCategory === cat
                  ? 'text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-600 dark:text-[rgba(255,255,255,0.6)] hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white liquid-glass-card'
              }`}
              style={{ background: selectedCategory === cat ? accentColor : undefined }}
            >
              {cat} ({groupedGuidelines[cat].length})
            </button>
          ))}
        </div>
      </div>

      {/* List - Enhanced with stagger animation */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredGuidelines.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl liquid-glass flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400 dark:text-slate-400 dark:text-[rgba(255,255,255,0.3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <p className="text-[15px] text-slate-500 dark:text-[rgba(255,255,255,0.5)]">No guidelines match your filters</p>
            <button
              onClick={() => { setSelectedCategory(null); setSelectedSeverity(null); setSearchQuery(""); }}
              className="mt-3 px-4 py-2 rounded-[10px] text-[13px] text-[#0A84FF] hover:bg-[rgba(10,132,255,0.1)] transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {filteredGuidelines.map((g, i) => {
              const config = severityConfig[g.severity] || severityConfig.informational;
              const isExpanded = expandedId === g.id;

              return (
                <div
                  key={g.id}
                  className={`group p-4 hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-all duration-200 animate-fade-in`}
                  style={{ animationDelay: `${i * 0.03}s` }}
                  onClick={() => setExpandedId(isExpanded ? null : g.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Severity indicator */}
                    <div
                      className="w-2 h-2 rounded-full mt-2 transition-transform group-hover:scale-125"
                      style={{ background: config.color }}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Category and metadata */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className="text-[11px] font-display font-medium px-2 py-0.5 rounded-full"
                          style={{
                            color: config.color,
                            background: config.bg,
                          }}
                        >
                          {g.category}
                        </span>
                        {g.page_reference && (
                          <span className="text-[11px] text-slate-400 dark:text-[rgba(255,255,255,0.35)] font-mono flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            p.{g.page_reference}
                          </span>
                        )}
                        <span
                          className="text-[10px] font-display uppercase tracking-wider ml-auto"
                          style={{ color: config.color, opacity: 0.8 }}
                        >
                          {config.label}
                        </span>
                      </div>

                      {/* Guideline text */}
                      <p
                        className={`text-[14px] text-slate-700 dark:text-slate-700 dark:text-[rgba(255,255,255,0.8)] leading-relaxed transition-all duration-200 ${
                          isExpanded ? '' : 'line-clamp-2'
                        }`}
                      >
                        {cleanGuidelineText(g.guideline)}
                      </p>

                      {/* Expand indicator */}
                      <div className="flex items-center gap-1 mt-2 text-[12px] text-slate-500 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span>{isExpanded ? 'Show less' : 'Show more'}</span>
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

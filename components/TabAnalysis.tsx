"use client";

import { useState } from "react";
import type { TabAnalysis as TabAnalysisType } from "@/lib/types";

type TabAnalysisProps = {
  analyses: TabAnalysisType[];
};

export function TabAnalysis({ analyses }: TabAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabAnalysisType["tab"]>(
    analyses[0]?.tab || "NON-QM"
  );

  const currentAnalysis = analyses.find((a) => a.tab === activeTab);
  if (!currentAnalysis) return null;

  const tabConfig = {
    "NON-QM": {
      color: "from-brand-500 to-blue-500",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.375 13.5h2.25m-2.25 3h2.25m-2.25 3h2.25m5.25-6h2.25m-2.25 3h2.25m-2.25 3h2.25" />
        </svg>
      ),
    },
    "DSCR": {
      color: "from-emerald-500 to-teal-500",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.086 0l.777.574" />
        </svg>
      ),
    },
  };

  const config = tabConfig[activeTab as keyof typeof tabConfig] || tabConfig["NON-QM"];
  const scoreColor = currentAnalysis.score >= 80 ? "text-emerald-400" : currentAnalysis.score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="relative overflow-hidden rounded-2xl glass-strong">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${config.color}`} />

      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <h2 className="font-heading font-semibold text-white mb-3">Guideline Analysis</h2>

        <div className="flex gap-2">
          {analyses.map((analysis) => {
            const tabConf = tabConfig[analysis.tab as keyof typeof tabConfig] || tabConfig["NON-QM"];
            const isActive = activeTab === analysis.tab;

            return (
              <button
                key={analysis.tab}
                onClick={() => setActiveTab(analysis.tab)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${tabConf.color} text-white shadow-lg`
                    : "bg-white/[0.04] text-slate-400 hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                }`}
              >
                {tabConf.icon}
                <span>{analysis.tab}</span>
                {isActive && (
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${scoreColor} bg-black/20`}>
                    {analysis.score}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Score Bar */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-400">Compliance Score</span>
          <span className={`text-2xl font-heading font-bold tabular-nums ${scoreColor}`}>
            {currentAnalysis.score}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${config.color} transition-all duration-1000`}
            style={{ width: `${currentAnalysis.score}%` }}
          />
        </div>
      </div>

      {/* Topics Grid */}
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Covered Topics */}
          <div className="relative overflow-hidden rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-4">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <h3 className="flex items-center gap-2 text-xs font-heading font-semibold text-emerald-400 mb-3 uppercase tracking-wider">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Covered ({currentAnalysis.coveredTopics.length})
            </h3>
            {currentAnalysis.coveredTopics.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {currentAnalysis.coveredTopics.map((topic, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    {topic}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No topics identified</p>
            )}
          </div>

          {/* Missing Topics */}
          <div className="relative overflow-hidden rounded-xl bg-red-500/[0.06] border border-red-500/20 p-4">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <h3 className="flex items-center gap-2 text-xs font-heading font-semibold text-red-400 mb-3 uppercase tracking-wider">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Missing ({currentAnalysis.missingTopics.length})
            </h3>
            {currentAnalysis.missingTopics.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {currentAnalysis.missingTopics.map((topic, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {topic}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-400 italic">All topics covered! ✓</p>
            )}
          </div>
        </div>

        {/* Matched Guidelines */}
        {currentAnalysis.matchedGuidelines.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-heading font-semibold text-slate-400 mb-3 uppercase tracking-wider">Guideline Matches</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currentAnalysis.matchedGuidelines.slice(0, 5).map((match, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 transition-all hover:scale-[1.005] border ${
                    match.foundInSellerGuide
                      ? "bg-emerald-500/[0.06] border-emerald-500/20"
                      : "bg-white/[0.02] border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-medium text-white text-sm">{match.topic}</span>
                      <span className="ml-2 text-[10px] text-slate-500 font-mono">({match.category})</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      match.confidence === "high" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : match.confidence === "medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {match.confidence}
                    </span>
                  </div>
                  {match.evidence && (
                    <p className="mt-1.5 text-xs text-slate-400 italic line-clamp-2">"{match.evidence}"</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
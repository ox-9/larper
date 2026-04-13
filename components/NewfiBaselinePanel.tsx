"use client";

import { useState } from "react";
import type { ExtractedGuideline } from "@/lib/types";

type Props = {
  baselineText: string;
  onBaselineTextChange: (text: string) => void;
  guidelines: ExtractedGuideline[];
  onImportFromPDF: () => void;
  isCollapsed: boolean;
  onToggle: () => void;
};

export function NewfiBaselinePanel({
  baselineText,
  onBaselineTextChange,
  guidelines,
  onImportFromPDF,
  isCollapsed,
  onToggle,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [...new Set(guidelines.map((g) => g.category))];
  const filtered = selectedCategory ? guidelines.filter((g) => g.category === selectedCategory) : guidelines;

  return (
    <div className={`liquid-liquid-glass-strong transition-all duration-300 ${isCollapsed ? "w-12" : "w-80"}`}>
      <div className="p-3 flex items-center justify-between border-b border-[rgba:255,255,255,0.06)]">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#30D158] to-[#34C759] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
              </svg>
            </div>
            <span className="font-display font-semibold text-[13px] text-white">Baseline</span>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-[6px] hover:bg-[rgba:255,255,255,0.08)]">
          <svg className={`w-4 h-4 text-[rgba:255,255,255,0.5)] transition-transform ${isCollapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={isCollapsed ? "M9 5l7 7-7 7M5 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
          <div>
            <label className="text-[11px] font-display text-[rgba:255,255,255,0.45)] mb-1 block">Paste Guidelines</label>
            <textarea
              value={baselineText}
              onChange={(e) => onBaselineTextChange(e.target.value)}
              placeholder="Paste here..."
              className="w-full h-20 rounded-[10px] p-2.5 text-[13px] font-mono liquid-glass text-white placeholder-[rgba:255,255,255,0.3)] resize-none focus:outline-none"
            />
          </div>

          <button onClick={onImportFromPDF} className="w-full py-2.5 rounded-[10px] bg-[#30D158] text-white font-display font-medium text-[13px]">
            Import from PDF
          </button>

          {guidelines.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setSelectedCategory(null)} className="px-2 py-1 rounded-[6px] text-[10px] font-medium" style={{ background: selectedCategory === null ? '#30D158' : 'rgba(255,255,255,0.08)', color: selectedCategory === null ? 'white' : 'rgba(255,255,255,0.6)' }}>
                  All ({guidelines.length})
                </button>
                {categories.map((c) => (
                  <button key={c} onClick={() => setSelectedCategory(c)} className="px-2 py-1 rounded-[6px] text-[10px] font-medium liquid-liquid-glass-card">
                    {c}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[rgba:255,255,255,0.06)]">
                <div className="p-2.5 rounded-[10px] liquid-glass">
                  <p className="text-[10px] text-[rgba:255,255,255,0.4)] font-display">Categories</p>
                  <p className="text-[18px] font-display font-bold text-white font-mono">{categories.length}</p>
                </div>
                <div className="p-2.5 rounded-[10px] liquid-glass">
                  <p className="text-[10px] text-[rgba:255,255,255,0.4)] font-display">Guidelines</p>
                  <p className="text-[18px] font-display font-bold text-white font-mono">{guidelines.length}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
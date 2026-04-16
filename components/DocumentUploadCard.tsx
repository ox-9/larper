"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import type { DocumentInfo } from "@/lib/types";

type DocumentUploadCardProps = {
  document: DocumentInfo;
  documentType: "A" | "B" | "C";
  onFileSelect: (file: File) => void;
  onExtract: () => void;
  onClear: () => void;
  isExtracting: boolean;
  extractionProgress: number;
  isTarget: boolean;
};

export function DocumentUploadCard({
  document,
  documentType,
  onFileSelect,
  onExtract,
  onClear,
  isExtracting,
  extractionProgress,
  isTarget,
}: DocumentUploadCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = documentType === "A" ? "Seller Guide" : documentType === "B" ? "NewFI Baseline" : "NewFI Overlays";
  const color = documentType === "A" ? "#0A84FF" : documentType === "B" ? "#30D158" : "#FF9F0A";
  const secondaryColor = documentType === "A" ? "#5E5CE6" : documentType === "B" ? "#34C759" : "#FF6B35";

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isExtracting) setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (isExtracting) return;
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") onFileSelect(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleClick() {
    if (!isExtracting && !document.extracted) inputRef.current?.click();
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[16px] transition-all duration-300 ${
        isDragOver
          ? 'scale-[1.02] ring-2 ring-[#0A84FF]/50 shadow-[0_0_40px_rgba(10,132,255,0.2)]'
          : 'card-lift'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient border effect */}
      <div
        className="absolute inset-0 rounded-[16px] p-[1px] opacity-0 transition-opacity duration-300"
        style={{
          opacity: isHovered || isDragOver ? 1 : 0,
          background: `linear-gradient(135deg, ${color}80, ${secondaryColor}40, transparent)`
        }}
      >
        <div className="w-full h-full rounded-[15px] bg-[#1c1c1e]" />
      </div>

      <div className="relative liquid-glass-card"
        style={{
          background: isDragOver
            ? `linear-gradient(135deg, rgba(10,132,255,0.08), rgba(30,30,32,0.8))`
            : undefined
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          disabled={isExtracting}
          className="hidden"
        />

        <div className={`p-6 ${isExtracting ? 'opacity-80' : !document.extracted ? 'cursor-pointer' : ''}`}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-[14px] flex items-center justify-center text-[15px] font-bold text-slate-900 dark:text-white shadow-lg transition-transform duration-300"
              style={{
                background: `linear-gradient(135deg, ${color} 0%, ${secondaryColor} 100%)`,
                transform: isHovered ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              {documentType}
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-[16px] text-slate-900 dark:text-white">{label}</h3>
              <p className="text-[13px] text-slate-500 dark:text-slate-500 dark:text-[rgba(255,255,255,0.45)]">
                {documentType === "A" ? "Upload seller guide PDF" : documentType === "B" ? "Upload baseline PDF" : "Upload overlay PDF"}
              </p>
            </div>
            {/* Status indicator */}
            <div
              className="w-3 h-3 rounded-full transition-all duration-300"
              style={{
                background: document.extracted ? '#30D158' : document.uploaded ? '#FF9F0A' : 'rgba(255,255,255,0.2)',
                boxShadow: document.extracted ? '0 0 12px #30D158' : 'none'
              }}
            />
          </div>

          {!document.uploaded ? (
            <div className="text-center py-10">
              <div
                className="w-20 h-20 mx-auto mb-5 rounded-2xl liquid-glass flex items-center justify-center transition-all duration-300"
                style={{
                  transform: isHovered ? 'scale(1.1) translateY(-4px)' : 'scale(1)',
                  boxShadow: isHovered ? `0 20px 40px ${color}20` : 'none'
                }}
              >
                <svg className="w-10 h-10 text-slate-400 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-[17px] font-display text-slate-900 dark:text-white mb-2 font-medium">Drop PDF here</p>
              <p className="text-[14px] text-slate-400 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)]">or click to browse</p>

              {/* File type hint */}
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.05)]">
                <svg className="w-4 h-4 text-slate-400 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
                </svg>
                <span className="text-[12px] text-slate-400 dark:text-slate-400 dark:text-[rgba(255,255,255,0.4)]">PDF files only</span>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File Info - Enhanced */}
              <div className="flex items-center gap-4 p-4 rounded-[14px] liquid-glass group">
                <div
                  className="w-14 h-14 rounded-[12px] liquid-glass flex items-center justify-center transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${color}15 0%, ${secondaryColor}10 100%)`
                  }}
                >
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-medium text-[15px] text-slate-900 dark:text-white truncate">{document.name}</p>
                  <p className="text-[13px] text-slate-500 dark:text-slate-500 dark:text-[rgba(255,255,255,0.45)] font-mono">
                    {formatFileSize(document.size)}{document.pageCount > 0 ? ` · ${document.pageCount} pages` : ''}
                  </p>
                </div>
                {!isExtracting && !document.extracted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    className="p-2.5 rounded-[10px] hover:bg-slate-200 dark:hover:bg-[rgba(255,255,255,0.1)] transition-all hover:rotate-90"
                  >
                    <svg className="w-5 h-5 text-slate-500 dark:text-slate-500 dark:text-[rgba(255,255,255,0.45)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Progress - Enhanced */}
              {isExtracting && isTarget && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-[#0A84FF] border-t-transparent animate-spin" />
                      <span className="text-[14px] text-slate-600 dark:text-[rgba(255,255,255,0.7)] font-display">Extracting guidelines...</span>
                    </div>
                    <span className="text-[15px] text-slate-900 dark:text-white font-medium font-mono">{extractionProgress}%</span>
                  </div>
                  <div className="progress-container h-2 rounded-full">
                    <div className="progress-bar rounded-full" style={{ width: `${extractionProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Error Display */}
              {document.error && !isExtracting && (
                <div
                  className="flex items-start gap-3 px-4 py-3 rounded-[12px] animate-fade-in"
                  style={{
                    background: 'rgba(255, 59, 48, 0.1)',
                    border: '1px solid rgba(255, 59, 48, 0.25)'
                  }}
                >
                  <div className="w-6 h-6 rounded-full bg-[#FF453A] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[#FF453A] font-medium leading-relaxed">{document.error}</p>
                    {document.error?.includes("API key") && (
                      <p className="text-[12px] text-[rgba(255,69,58,0.7)] mt-1">
                        Get a free API key at aistudio.google.com/apikey
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Complete - Enhanced */}
              {document.extracted && !document.error && (
                <div
                  className="flex items-center gap-3 px-5 py-3.5 rounded-[14px] animate-fade-in"
                  style={{
                    background: 'rgba(48, 209, 88, 0.1)',
                    border: '1px solid rgba(48, 209, 88, 0.25)'
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#30D158] flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[15px] text-[#30D158] font-display font-medium">
                      {document.guidelines.length} guidelines extracted
                    </span>
                    <p className="text-[12px] text-[rgba(48,209,88,0.7)]">Ready for comparison</p>
                  </div>
                </div>
              )}

              {/* Extract Button - Enhanced */}
              {!document.extracted && !isExtracting && (
                <button
                  onClick={(e) => { e.stopPropagation(); onExtract(); }}
                  className="w-full py-4 rounded-[14px] text-slate-900 dark:text-white font-display font-semibold text-[16px] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${color} 0%, ${secondaryColor} 100%)`,
                    boxShadow: `0 8px 32px ${color}40`
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Extract Guidelines
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";

type FileUploadProps = {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  selectedFileName: string | null;
};

export function FileUpload({
  onFileSelect,
  isProcessing,
  selectedFileName,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isProcessing) setIsDragOver(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") onFileSelect(file);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleClick() {
    if (!isProcessing) inputRef.current?.click();
  }

  return (
    <div className="relative">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative overflow-hidden rounded-2xl p-10 transition-all duration-300 cursor-pointer ${
          isDragOver
            ? "dashed-border-animated bg-brand-500/10 scale-[1.01]"
            : selectedFileName
            ? "bg-emerald-500/5 border-2 border-emerald-500/30"
            : "dashed-border-animated bg-white/[0.02] hover:bg-brand-500/[0.04]"
        } ${isProcessing ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          disabled={isProcessing}
          className="hidden"
        />

        {isDragOver && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-500/10 backdrop-blur-sm z-10 rounded-2xl">
            <div className="text-center">
              <svg className="w-14 h-14 mx-auto text-brand-400 animate-bounce mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-lg font-semibold text-brand-300">Drop your PDF here</p>
            </div>
          </div>
        )}

        <div className="relative z-0 text-center">
          {!selectedFileName ? (
            <>
              <div className="mb-5 inline-flex p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20">
                <svg className="w-10 h-10 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0h3m-3 3h3m-6-3h.008v.008H9.75V15zm0 3h.008v.008H9.75V18zm-3-3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18zM3 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 5.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-heading font-semibold text-white mb-2">
                Upload Seller Guide
              </h3>
              <p className="text-sm text-slate-400 mb-4 max-w-xs mx-auto">
                Drag & drop your PDF, or click to browse
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-300 text-xs font-medium border border-brand-500/20">
                  PDF Only
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-700/30 text-slate-400 text-xs font-medium border border-slate-600/20">
                  Max 50MB
                </span>
              </div>
            </>
          ) : (
            <div className="animate-scale-in">
              <div className="mb-4 inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-heading font-semibold text-emerald-400 mb-1.5">
                Ready to Analyze
              </h3>
              <p className="text-slate-300 text-sm font-mono bg-slate-800/50 px-3 py-1.5 rounded-lg inline-block">
                {selectedFileName}
              </p>
              <p className="text-slate-500 text-xs mt-2">
                Click to replace
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
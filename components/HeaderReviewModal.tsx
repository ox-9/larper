"use client";

import { useState, useMemo } from "react";

interface RawHeader {
  index: number;
  type: string;
  sectionNumber: string | null;
  title: string;
  page: number;
  level: number;
}

interface HeaderReviewModalProps {
  headers: RawHeader[];
  documentName: string;
  onApprove: (selectedIndices: number[]) => void;
  onCancel: () => void;
}

export function HeaderReviewModal({ headers, documentName, onApprove, onCancel }: HeaderReviewModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set(headers.map(h => h.index)));
  const [filter, setFilter] = useState<string>("all");

  const filteredHeaders = useMemo(() => {
    if (filter === "all") return headers;
    if (filter === "numbered") return headers.filter(h => h.sectionNumber);
    if (filter === "unnumbered") return headers.filter(h => !h.sectionNumber);
    if (filter.startsWith("level")) {
      const level = parseInt(filter.replace("level", ""));
      return headers.filter(h => h.level === level);
    }
    return headers;
  }, [headers, filter]);

  const handleToggle = (index: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  const handleSelectAll = () => {
    setSelected(new Set(filteredHeaders.map(h => h.index)));
  };

  const handleDeselectAll = () => {
    setSelected(new Set());
  };

  const handleApprove = () => {
    onApprove(Array.from(selected));
  };

  // Group by level for display
  const byLevel = useMemo(() => {
    const grouped: Record<number, RawHeader[]> = {};
    filteredHeaders.forEach(h => {
      if (!grouped[h.level]) grouped[h.level] = [];
      grouped[h.level].push(h);
    });
    return grouped;
  }, [filteredHeaders]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#1a1a1c] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[rgba(255,255,255,0.1)] bg-gray-50 dark:bg-[#0f0f10]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Review Extracted Headers
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {documentName} — {headers.length} headers found
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-200 dark:hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#1a1a1c]">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-500 dark:text-gray-400">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-[rgba(255,255,255,0.2)] bg-white dark:bg-[#0f0f10] text-gray-900 dark:text-white"
            >
              <option value="all">All Headers ({headers.length})</option>
              <option value="numbered">Numbered Only ({headers.filter(h => h.sectionNumber).length})</option>
              <option value="unnumbered">Unnumbered ({headers.filter(h => !h.sectionNumber).length})</option>
              <option value="level1">Level 1 ({headers.filter(h => h.level === 1).length})</option>
              <option value="level2">Level 2 ({headers.filter(h => h.level === 2).length})</option>
              <option value="level3">Level 3+ ({headers.filter(h => h.level >= 3).length})</option>
            </select>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm font-medium text-[#0A84FF] hover:bg-[#0A84FF]/10 rounded-lg transition-colors"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              <strong>{selected.size}</strong> of <strong>{headers.length}</strong> selected
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500 dark:text-gray-400">
              Expected: 100-120 guidelines for typical seller guide
            </span>
          </div>
        </div>

        {/* Header list */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-[#0f0f10]">
          <div className="space-y-4">
            {Object.entries(byLevel).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([level, levelHeaders]) => (
              <div key={level} className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50/95 dark:bg-[#0f0f10]/95 py-2">
                  Level {level} — {levelHeaders.length} headers
                </h3>
                <div className="space-y-1">
                  {levelHeaders.map((header) => (
                    <div
                      key={header.index}
                      onClick={() => handleToggle(header.index)}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        selected.has(header.index)
                          ? "bg-[#0A84FF]/10 border border-[#0A84FF]/30"
                          : "bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-[rgba(255,255,255,0.1)] hover:border-gray-300 dark:hover:border-[rgba(255,255,255,0.2)]"
                      }`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        selected.has(header.index)
                          ? "bg-[#0A84FF] border-[#0A84FF]"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {selected.has(header.index) && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {header.sectionNumber && (
                            <span className="px-2 py-0.5 text-xs font-mono font-medium bg-gray-100 dark:bg-[rgba(255,255,255,0.1)] text-gray-700 dark:text-gray-300 rounded">
                              {header.sectionNumber}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">Page {header.page}</span>
                          <span className="text-xs text-gray-400">|</span>
                          <span className="text-xs text-gray-500">{header.type}</span>
                        </div>
                        <p className={`mt-1 text-sm font-medium ${
                          selected.has(header.index)
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-600 dark:text-gray-400"
                        }`}>
                          {header.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#1a1a1c]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selected.size < 50 && (
                <span className="text-amber-600 dark:text-amber-400">⚠️ Few headers selected — may miss content</span>
              )}
              {selected.size > 150 && (
                <span className="text-amber-600 dark:text-amber-400">⚠️ Many headers selected — may be too granular</span>
              )}
              {selected.size >= 50 && selected.size <= 150 && (
                <span className="text-green-600 dark:text-green-400">✓ Good selection range</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={selected.size === 0}
                className="px-6 py-2 text-sm font-medium text-white bg-[#0A84FF] hover:bg-[#0066CC] disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Extract {selected.size} Guidelines
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

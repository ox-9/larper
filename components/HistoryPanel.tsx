"use client";

import type { HistoryEntry } from "@/lib/types";

type HistoryPanelProps = {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
};

export function HistoryPanel({ history, onSelect, onClear }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50 p-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-600 to-zinc-700" />

        <h2 className="text-lg font-bold text-white mb-2">History</h2>
        <div className="text-center py-8">
          <div className="inline-flex p-4 rounded-full bg-zinc-800 mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-zinc-500">No analyses yet</p>
          <p className="text-sm text-zinc-600">Upload a seller guide to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 border border-zinc-700/50">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />

      <div className="p-4 border-b border-zinc-700/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">History</h2>
          <button
            onClick={onClear}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="divide-y divide-zinc-700/50 max-h-80 overflow-y-auto">
        {history.map((entry, i) => {
          const scoreColor = entry.overallScore >= 80 ? "from-emerald-500 to-teal-500" :
                             entry.overallScore >= 50 ? "from-amber-500 to-orange-500" :
                             "from-red-500 to-rose-500";

          return (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="w-full p-4 text-left hover:bg-zinc-800/50 transition-all group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-r ${scoreColor} flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">{entry.overallScore}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                    {entry.fileName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {new Date(entry.processedAt).toLocaleString()}
                  </p>
                </div>

                <svg className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
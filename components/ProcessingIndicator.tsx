"use client";

import type { ProcessingState } from "@/lib/types";

type ProcessingIndicatorProps = {
  state: ProcessingState;
};

export function ProcessingIndicator({ state }: ProcessingIndicatorProps) {
  if (state.stage === "idle") return null;

  const configs = {
    uploading: {
      icon: (
        <svg className="w-7 h-7 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      ),
      gradient: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10 border-blue-500/25",
      textColor: "text-blue-400",
      label: "Uploading",
    },
    extracting: {
      icon: (
        <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.25A2.25 2.25 0 003 5.25v13.5A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V5.25a2.25 2.25 0 00-2.25-2.25H10.5z" />
        </svg>
      ),
      gradient: "from-brand-500 to-blue-500",
      bgColor: "bg-brand-500/10 border-brand-500/25",
      textColor: "text-brand-400",
      label: "Extracting",
    },
    analyzing: {
      icon: (
        <svg className="w-7 h-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      gradient: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10 border-amber-500/25",
      textColor: "text-amber-400",
      label: "AI Analyzing",
    },
    complete: {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10 border-emerald-500/25",
      textColor: "text-emerald-400",
      label: "Complete!",
    },
    error: {
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      ),
      gradient: "from-red-500 to-rose-500",
      bgColor: "bg-red-500/10 border-red-500/25",
      textColor: "text-red-400",
      label: "Error",
    },
  };

  const config = configs[state.stage];
  const isComplete = state.stage === "complete";
  const isError = state.stage === "error";
  const isActive = !isComplete && !isError;

  return (
    <div className={`relative overflow-hidden rounded-2xl glass border ${config.bgColor} p-5 animate-scale-in`}>
      {/* Animated top bar */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-0.5">
          <div className={`h-full w-full bg-gradient-to-r ${config.gradient} animate-shimmer`} />
        </div>
      )}

      <div className="relative flex items-center gap-4">
        <div className={`flex-shrink-0 ${config.textColor}`}>{config.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className={`font-heading font-semibold ${config.textColor}`}>{config.label}</h3>
            {isActive && (
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 truncate">{state.message}</p>
        </div>

        {isActive && (
          <div className="flex-shrink-0 text-right">
            <span className={`text-2xl font-heading font-bold ${config.textColor} tabular-nums`}>
              {state.progress}%
            </span>
          </div>
        )}
      </div>

      {isActive && (
        <div className="mt-4">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500 ease-out`}
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {isComplete && (
        <div className="mt-4 flex gap-2.5">
          <button className="flex-1 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium text-sm hover:bg-emerald-500/15 transition-all">
            View Results
          </button>
          <button className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-slate-300 font-medium text-sm hover:bg-white/[0.08] transition-all">
            New Analysis
          </button>
        </div>
      )}
    </div>
  );
}
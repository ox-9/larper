"use client";

type RecommendationsProps = {
  recommendations: string[];
  criticalIssues: string[];
};

export function Recommendations({ recommendations, criticalIssues }: RecommendationsProps) {
  const hasCritical = criticalIssues.length > 0;
  const hasRecommendations = recommendations.length > 0;

  if (!hasCritical && !hasRecommendations) {
    return (
      <div className="relative overflow-hidden rounded-2xl glass p-6">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
        <div className="text-center py-8">
          <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-heading font-semibold text-white mb-2">All Clear!</h3>
          <p className="text-slate-400 text-sm">No critical issues or recommendations at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Critical Issues */}
      {hasCritical && (
        <div className="relative overflow-hidden rounded-2xl glass border border-red-500/20">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500" />

          <div className="p-5">
            <h3 className="flex items-center gap-2 font-heading font-semibold text-red-400 mb-4">
              <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              Critical Issues
              <span className="ml-auto px-2.5 py-0.5 rounded-lg bg-red-500/10 text-red-300 text-xs font-bold border border-red-500/20">
                {criticalIssues.length}
              </span>
            </h3>

            <ul className="space-y-2.5">
              {criticalIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2.5 group">
                  <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-300 group-hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white transition-colors">{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {hasRecommendations && (
        <div className="relative overflow-hidden rounded-2xl glass border border-brand-500/20">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-500 via-blue-500 to-cyan-500" />

          <div className="p-5">
            <h3 className="flex items-center gap-2 font-heading font-semibold text-brand-400 mb-4">
              <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              Suggestions for Improvement
              <span className="ml-auto px-2.5 py-0.5 rounded-lg bg-brand-500/10 text-brand-300 text-xs font-bold border border-brand-500/20">
                {recommendations.length}
              </span>
            </h3>

            <ul className="space-y-2.5">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 group">
                  <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-500" />
                  <span className="text-sm text-slate-300 group-hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white transition-colors">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
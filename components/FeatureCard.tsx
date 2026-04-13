"use client";

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  status?: "active" | "inactive" | "loading";
  onClick?: () => void;
};

export function FeatureCard({
  icon,
  title,
  description,
  gradient,
  status = "active",
  onClick,
}: FeatureCardProps) {
  const statusStyles = {
    active: "border-white/[0.06] hover:border-white/[0.12]",
    inactive: "border-white/[0.04] opacity-50",
    loading: "border-amber-500/20",
  };

  return (
    <button
      onClick={onClick}
      disabled={status !== "active"}
      className={`group relative overflow-hidden rounded-2xl glass card-hover p-5 text-left transition-all duration-300 border ${statusStyles[status]} ${
        status === "active" ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {/* Gradient line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

      {/* Icon */}
      <div className={`mb-4 inline-flex p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
        <div className="text-white">{icon}</div>
      </div>

      {/* Content */}
      <h3 className="font-heading font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>

      {/* Status indicator */}
      {status === "loading" && (
        <div className="absolute top-4 right-4">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        </div>
      )}
      {status === "active" && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      )}
    </button>
  );
}

type FeatureGridProps = {
  children: React.ReactNode;
};

export function FeatureGrid({ children }: FeatureGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  );
}
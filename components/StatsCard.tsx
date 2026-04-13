"use client";

import { useEffect, useState } from "react";

type StatsCardProps = {
  value: number;
  label: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  gradient?: string;
  suffix?: string;
  animate?: boolean;
};

export function StatsCard({
  value,
  label,
  icon,
  trend,
  trendValue,
  gradient = "from-brand-500 to-blue-500",
  suffix = "",
  animate = true,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!animate) { setDisplayValue(value); return; }
    const duration = 800;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, animate]);

  const trendColors = { up: "text-emerald-400", down: "text-red-400", neutral: "text-slate-400" };
  const trendIcons = {
    up: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
    down: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
    neutral: null,
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl glass card-hover p-5">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      {/* Subtle corner glow */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 opacity-[0.07]">
        <div className={`w-full h-full rounded-full bg-gradient-to-r ${gradient} blur-2xl`} />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <div className="text-white">{icon}</div>
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 ${trendColors[trend]}`}>
              {trendIcons[trend]}
              <span className="text-sm font-medium">{trendValue}</span>
            </div>
          )}
        </div>

        <div className="mb-1">
          <span className="text-3xl font-heading font-bold text-white tabular-nums">
            {displayValue.toLocaleString()}{suffix}
          </span>
        </div>

        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}

type StatsGridProps = { children: React.ReactNode };

export function StatsGrid({ children }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {children}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";

type ComplianceScoreProps = {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGrade?: boolean;
  animate?: boolean;
};

export function ComplianceScore({
  score,
  label = "Compliance Score",
  size = "lg",
  showGrade = true,
  animate = true,
}: ComplianceScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!animate) { setAnimatedScore(score); setIsAnimating(false); return; }
    const duration = 1500;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(score * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else setIsAnimating(false);
    };
    requestAnimationFrame(tick);
  }, [score, animate]);

  const getGrade = (s: number) => {
    if (s >= 90) return { grade: "A+", color: "text-emerald-400" };
    if (s >= 85) return { grade: "A", color: "text-emerald-400" };
    if (s >= 80) return { grade: "A-", color: "text-emerald-400" };
    if (s >= 75) return { grade: "B+", color: "text-green-400" };
    if (s >= 70) return { grade: "B", color: "text-green-400" };
    if (s >= 65) return { grade: "B-", color: "text-green-400" };
    if (s >= 60) return { grade: "C+", color: "text-amber-400" };
    if (s >= 55) return { grade: "C", color: "text-amber-400" };
    if (s >= 50) return { grade: "C-", color: "text-amber-400" };
    if (s >= 40) return { grade: "D", color: "text-orange-400" };
    return { grade: "F", color: "text-red-400" };
  };

  const getGradient = (s: number) => {
    if (s >= 80) return "from-emerald-500 via-green-500 to-teal-500";
    if (s >= 60) return "from-amber-500 via-yellow-500 to-orange-500";
    return "from-red-500 via-rose-500 to-pink-500";
  };

  const grade = getGrade(animatedScore);
  const gradient = getGradient(animatedScore);

  const sizes = {
    sm: { container: "h-24 w-24", text: "text-2xl", grade: "text-lg" },
    md: { container: "h-32 w-32", text: "text-3xl", grade: "text-xl" },
    lg: { container: "h-40 w-40", text: "text-4xl", grade: "text-xl" },
    xl: { container: "h-52 w-52", text: "text-5xl", grade: "text-2xl" },
  };

  const sizeConfig = sizes[size];
  const strokeWidth = size === "xl" ? 6 : size === "lg" ? 5 : 4;
  const radius = size === "xl" ? 110 : size === "lg" ? 80 : size === "md" ? 50 : 38;

  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  const gradientColors =
    animatedScore >= 80
      ? ["#059669", "#10B981", "#14B8A6"]
      : animatedScore >= 60
      ? ["#D97706", "#F59E0B", "#F97316"]
      : ["#DC2626", "#EF4444", "#F43F5E"];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative ${sizeConfig.container}`}>
        {/* Background glow */}
        <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${gradient} opacity-15 blur-xl ${isAnimating ? "animate-pulse" : ""}`} />

        <svg
          viewBox={`0 0 ${radius * 2 + strokeWidth * 4} ${radius * 2 + strokeWidth * 4}`}
          className="h-full w-full -rotate-90"
        >
          <circle cx="50%" cy="50%" r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-white/[0.06]" />
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {gradientColors.map((c, i) => (
                <stop key={i} offset={`${(i / (gradientColors.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-heading font-bold tabular-nums ${sizeConfig.text} ${grade.color}`}>
            {animatedScore}
          </span>
          {showGrade && (
            <span className={`font-heading font-bold ${sizeConfig.grade} ${grade.color}`}>
              {grade.grade}
            </span>
          )}
        </div>
      </div>

      <div className="text-center">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${gradient} text-white`}>
            {animatedScore >= 80 ? "EXCELLENT" : animatedScore >= 60 ? "NEEDS IMPROVEMENT" : "CRITICAL"}
          </span>
        </div>
      </div>
    </div>
  );
}
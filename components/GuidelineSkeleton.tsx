"use client";

import { useEffect, useState } from "react";

type GuidelineSkeletonProps = { count?: number };

export function GuidelineSkeleton({ count = 5 }: GuidelineSkeletonProps) {
  const [visibleRows, setVisibleRows] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleRows((prev) => (prev < count ? prev + 1 : prev));
    }, 50);
    return () => clearInterval(interval);
  }, [count]);

  return (
    <div className="liquid-liquid-glass-strong p-4 animate-fade-in">
      <div className="space-y-2.5">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={`p-4 rounded-[12px] liquid-glass transition-all duration-300 ${
              index < visibleRows ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="flex gap-2 mb-3">
              <div className="w-16 h-5 rounded-[6px] bg-[rgba:255,255,255,0.08)] animate-pulse" />
              <div className="w-12 h-5 rounded-[6px] bg-[rgba:255,255,255,0.08)] animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 rounded-[4px] bg-[rgba:255,255,255,0.08)] animate-pulse w-full" />
              <div className="h-3.5 rounded-[4px] bg-[rgba:255,255,255,0.08)] animate-pulse w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="liquid-glass p-4 animate-pulse">
          <div className="h-7 w-14 rounded-[6px] bg-[rgba:255,255,255,0.08)]" />
          <div className="h-3 w-20 rounded-[4px] bg-[rgba:255,255,255,0.08)] mt-2" />
        </div>
      ))}
    </div>
  );
}

export function ComparisonRowSkeleton({ count = 3 }: { count?: number }) {
  const [visibleRows, setVisibleRows] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleRows((prev) => (prev < count ? prev + 1 : prev));
    }, 80);
    return () => clearInterval(interval);
  }, [count]);

  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex gap-4 p-4 rounded-[12px] liquid-glass transition-all ${i < visibleRows ? "opacity-100" : "opacity-0"}`}>
          <div className="w-20">
            <div className="w-16 h-6 rounded-[6px] bg-[rgba:255,255,255,0.08)] animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded-[4px] bg-[rgba:255,255,255,0.08)] animate-pulse" />
            <div className="h-3.5 w-full rounded-[4px] bg-[rgba:255,255,255,0.08)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
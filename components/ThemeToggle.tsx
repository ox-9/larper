"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggleTheme() {
    if (isAnimating) return;
    setIsAnimating(true);

    const newDark = !isDark;
    setIsDark(newDark);

    // Delay the theme change slightly for animation
    setTimeout(() => {
      if (newDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      setIsAnimating(false);
    }, 150);
  }

  if (!mounted) return <div className="w-10 h-10 rounded-[12px] liquid-glass" />;

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-[12px] liquid-glass-card flex items-center justify-center overflow-hidden group"
      style={{
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Background glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: isDark
            ? "radial-gradient(circle at center, rgba(255,159,10,0.2) 0%, transparent 70%)"
            : "radial-gradient(circle at center, rgba(10,132,255,0.2) 0%, transparent 70%)",
        }}
      />

      {/* Sun/Moon icons with rotation animation */}
      <div
        className="relative transition-transform duration-300"
        style={{
          transform: isAnimating ? "rotate(180deg) scale(0.8)" : "rotate(0deg) scale(1)",
        }}
      >
        {isDark ? (
          <svg
            className="w-[18px] h-[18px] text-slate-600 dark:text-[rgba(255,255,255,0.7)] group-hover:text-[#FF9F0A] transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
            />
          </svg>
        ) : (
          <svg
            className="w-[18px] h-[18px] text-[#FF9F0A] group-hover:text-[#0A84FF] transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
            />
          </svg>
        )}
      </div>

      {/* Ripple effect on click */}
      {isAnimating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-full h-full rounded-[12px]"
            style={{
              background: isDark
                ? "radial-gradient(circle, rgba(255,159,10,0.3) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(10,132,255,0.3) 0%, transparent 70%)",
              animation: "ripple 0.3s ease-out",
            }}
          />
        </div>
      )}
    </button>
  );
}

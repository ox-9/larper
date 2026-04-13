import type { HistoryEntry } from "./types";

const STORAGE_KEY = "newfi_analysis_history";
const MAX_ENTRIES = 10;

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  const history = getHistory();

  // Remove duplicates (same filename)
  const filtered = history.filter((h) => h.fileName !== entry.fileName);

  // Add new entry at the beginning
  const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage might be full, try clearing old entries
    console.warn("Failed to save history to localStorage");
  }

  return updated;
}

export function clearHistory(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

export function generateHistoryId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
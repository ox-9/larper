"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
};

type LarpGPTProps = {
  documentContext?: string;
  guidelinesContext?: string;
};

// ── Markdown Renderer ──────────────────────────────────────────────────

function parseMarkdown(text: string): React.ReactNode {
  // Split into code blocks and non-code sections
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const code = part.slice(3, -3);
      const firstNewline = code.indexOf("\n");
      const lang = firstNewline > 0 ? code.slice(0, firstNewline).trim() : "";
      const codeText = firstNewline > 0 ? code.slice(firstNewline + 1) : code;
      return (
        <pre
          key={i}
          className="my-3 p-4 rounded-[12px] overflow-x-auto border border-[rgba(255,255,255,0.06)]"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          {lang && !lang.includes(" ") && (
            <div className="text-[10px] text-slate-400 dark:text-[rgba(255,255,255,0.4)] mb-2 font-mono uppercase tracking-wider">
              {lang}
            </div>
          )}
          <code className="text-[13px] text-slate-700 dark:text-[rgba(255,255,255,0.85)] font-mono">
            {codeText}
          </code>
        </pre>
      );
    }
    return <span key={i}>{parseBlocks(part)}</span>;
  });
}

function parseBlocks(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h4 key={key++} className="text-[15px] font-semibold text-white mt-4 mb-2">{parseInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h3 key={key++} className="text-[16px] font-semibold text-white mt-4 mb-2">{parseInline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h2 key={key++} className="text-[18px] font-bold text-white mt-4 mb-2">{parseInline(line.slice(2))}</h2>);
      i++; continue;
    }

    // Unordered list
    if (/^[\s]*[-*•]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[\s]*[-*•]\s/.test(lines[i])) {
        const indent = lines[i].match(/^(\s*)/)?.[1].length || 0;
        const content = lines[i].replace(/^[\s]*[-*•]\s/, "");
        items.push(
          <li key={key++} className={indent > 2 ? "ml-6" : "ml-4"} style={{ listStyleType: "disc" }}>
            {parseInline(content)}
          </li>
        );
        i++;
      }
      elements.push(<ul key={key++} className="my-2 space-y-1 text-[14px]">{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s/.test(lines[i])) {
        const content = lines[i].replace(/^[\s]*\d+\.\s/, "");
        items.push(
          <li key={key++} className="ml-4 list-decimal">
            {parseInline(content)}
          </li>
        );
        i++;
      }
      elements.push(<ol key={key++} className="my-2 space-y-1 text-[14px]">{items}</ol>);
      continue;
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(parseTable(tableLines, key));
      key++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
      i++; continue;
    }

    // Regular paragraph
    elements.push(<p key={key++} className="text-[14px] leading-relaxed">{parseInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

function parseTable(lines: string[], baseKey: number): React.ReactNode {
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split("|").map((c) => c.trim()).filter(Boolean);

  const headers = parseRow(lines[0]);
  // Skip separator row (line with ---)
  const dataStart = lines[1].includes("---") ? 2 : 1;
  const rows = lines.slice(dataStart).map(parseRow);

  return (
    <div key={baseKey} className="my-3 overflow-x-auto rounded-[10px] border border-[rgba(255,255,255,0.08)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[rgba(0,0,0,0.3)]">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-[rgba(255,255,255,0.7)] font-semibold whitespace-nowrap">
                {parseInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-[rgba(0,0,0,0.15)]" : "bg-[rgba(0,0,0,0.05)]"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-[rgba(255,255,255,0.8)] whitespace-nowrap">
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);
    const matches = [
      boldMatch ? { type: "bold", match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: "code", match: codeMatch, index: codeMatch.index! } : null,
    ].filter(Boolean) as { type: string; match: RegExpMatchArray; index: number }[];

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    const earliest = matches.sort((a, b) => a.index - b.index)[0];
    if (earliest.index > 0) parts.push(<span key={key++}>{remaining.slice(0, earliest.index)}</span>);

    if (earliest.type === "bold") {
      parts.push(<strong key={key++} className="font-semibold text-white">{earliest.match[1]}</strong>);
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    } else {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-[5px] text-[#64D2FF] text-[13px] font-mono"
          style={{ background: "rgba(100,210,255,0.12)" }}
        >
          {earliest.match[1]}
        </code>
      );
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }
  }
  return parts;
}

export function LarpGPT({ documentContext, guidelinesContext }: LarpGPTProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = [
    { text: "Credit score requirements?", icon: "📊" },
    { text: "Explain DSCR loans", icon: "🏦" },
    { text: "Bank statement docs", icon: "📄" },
    { text: "Bankruptcy seasoning", icon: "⏱️" },
    { text: "LTV ratios explained", icon: "📈" },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    // Build context
    let contextMessage = "";
    if (documentContext || guidelinesContext) {
      contextMessage = `\n\nContext:\n${guidelinesContext?.slice(0, 5000) || ""}`;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: text + contextMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "token" && parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.content }
                    : m
                )
              );
            } else if (parsed.type === "error") {
              setError(parsed.error);
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorMessage = err instanceof Error ? err.message : "Error";
      setError(errorMessage);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || `Sorry, I encountered an error: ${errorMessage}. Please try again.`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      // Mark streaming complete
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    }
  }, [documentContext, guidelinesContext, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center shadow-lg animate-pulse-glow">
            <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display font-semibold text-[16px] text-white">LarpGPT</h2>
            <p className="text-[12px] text-slate-500 dark:text-[rgba(255,255,255,0.45)]">AI-Powered Mortgage Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] liquid-glass-card text-[12px] font-display text-[#FF453A] hover:bg-[rgba(255,69,58,0.1)] transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] liquid-glass-card text-[12px] font-display text-slate-500 dark:text-[rgba(255,255,255,0.5)] hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[rgba(255,255,255,0.1)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl liquid-glass flex items-center justify-center animate-float">
              <svg className="w-10 h-10 text-[#0A84FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h3 className="font-display text-[22px] font-semibold text-white mb-2">Welcome to LarpGPT</h3>
            <p className="text-[15px] text-slate-500 dark:text-[rgba(255,255,255,0.45)] max-w-md mx-auto mb-8">
              Ask me anything about mortgage guidelines, underwriting, and compliance. I'm here to help.
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] liquid-glass-card text-[13px] text-slate-600 dark:text-[rgba(255,255,255,0.7)] hover:text-slate-900 dark:hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-all group"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <span className="group-hover:scale-110 transition-transform">{s.icon}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-fade-in ${message.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-[18px] px-5 py-3.5 shadow-lg ${
                message.role === "user"
                  ? "bg-gradient-to-br from-[#0A84FF] to-[#0066CC] text-white"
                  : "glass text-slate-800 dark:text-[rgba(255,255,255,0.9)]"
              }`}
            >
              <div className="text-[15px] leading-[1.55]">
                {message.role === "assistant" ? parseMarkdown(message.content) : <span className="whitespace-pre-wrap">{message.content}</span>}
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 bg-[#0A84FF] animate-pulse ml-0.5 align-middle" />
                )}
              </div>
              {!message.isStreaming && (
                <div
                  className={`text-[11px] mt-2 font-mono ${
                    message.role === "user" ? "text-slate-600 dark:text-[rgba(255,255,255,0.6)]" : "text-slate-400 dark:text-[rgba(255,255,255,0.35)]"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.06)]">
        <div
          className={`flex gap-3 p-2 rounded-[16px] transition-all duration-200 ${
            isFocused ? "glass ring-2 ring-[#0A84FF]/30" : "glass"
          }`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask about mortgage guidelines..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-transparent text-white text-[15px] placeholder-[rgba(255,255,255,0.35)] resize-none focus:outline-none disabled:opacity-50 min-h-[24px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-[12px] bg-[#0A84FF] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-[#0070E0] hover:scale-105 active:scale-95 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-2 text-[13px] text-[#FF453A]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
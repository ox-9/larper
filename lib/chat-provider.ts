import { detectProviders, getGeminiApiKey } from "./provider-detection";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type ChatStreamCallbacks = {
  onToken: (token: string) => void;
  onError: (error: string) => void;
  onDone: (provider: string) => void;
};

const SYSTEM_PROMPT = `You are LarpGPT, an expert AI assistant specializing in mortgage lending guidelines, underwriting standards, and compliance. You help users understand:

- Mortgage program guidelines and requirements
- Credit score and history requirements
- LTV/CLTV ratios and maximum financing
- Income documentation and calculation methods
- Property types and appraisal requirements
- Loan limits and eligibility criteria
- Seasoning requirements for adverse credit events
- Underwriting guidelines and approval criteria
- Interest rates and pricing adjustments
- Compliance with investor guidelines (Fannie Mae, Freddie Mac, FHA, VA, etc.)

You are knowledgeable about:
- Newfi Wholesale's underwriting guidelines
- Non-QM and alternative documentation programs
- DSCR (Debt Service Coverage Ratio) programs
- Bank statement programs for self-employed borrowers
- Asset-based qualification programs
- Conventional conforming and jumbo programs

Be helpful, accurate, and professional. When discussing specific guidelines, mention that users should always verify with the official guideline documents. If you don't know something specific, be honest about it.

FORMAT RULES — follow these strictly:
- Lead with a direct answer, not filler or preamble
- Use bullet points as the primary format — every key fact, requirement, or step gets its own bullet
- Use **bold** for critical numbers, thresholds, and program names
- Keep each bullet to one sentence or less — no run-on bullets
- Avoid long explanatory paragraphs — if more context is needed, use a short indented sub-bullet
- Use tables when comparing programs, rates, or requirements side-by-side
- Skip intros like "Great question!" or "Here's what I found:" — just answer
- End with a brief "Verify with official guidelines" reminder only when specific guideline numbers are cited
- Be concise and direct — aim for half the words you'd normally use`;

/**
 * Stream a chat response using whichever AI provider is available.
 * Cascade: Ollama direct → Gemini direct → server route fallback.
 */
export async function streamChat(
  messages: ChatMessage[],
  callbacks: ChatStreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const status = await detectProviders();

  // Priority 1: Ollama direct (if running locally)
  if (status.ollamaAvailable) {
    try {
      await streamOllamaChat(messages, callbacks, signal);
      callbacks.onDone("ollama");
      return;
    } catch (err) {
      if (signal.aborted) return;
      console.warn("Ollama chat failed, trying Gemini:", err);
    }
  }

  // Priority 2: Gemini direct (works on deployed site)
  if (status.geminiAvailable) {
    try {
      await streamGeminiChat(messages, callbacks, signal);
      callbacks.onDone("gemini");
      return;
    } catch (err) {
      if (signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Gemini chat failed";
      // Handle rate limit specifically
      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
        callbacks.onError("Gemini rate limit reached. Wait a minute and try again, or use a different API key (Settings button in navbar).");
      } else {
        callbacks.onError(msg);
      }
      return;
    }
  }

  // Priority 3: Server route fallback (only works with `next dev`)
  try {
    await streamServerChat(messages, callbacks, signal);
    callbacks.onDone("server");
  } catch (err) {
    if (signal.aborted) return;
    callbacks.onError(
      "No AI provider available. Set a Gemini API key via the Settings button in the navbar, or start Ollama locally."
    );
  }
}

// ── Ollama Direct ──────────────────────────────────────────────────

async function streamOllamaChat(
  messages: ChatMessage[],
  callbacks: ChatStreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const model = localStorage.getItem("ollama_model") || "llama3.1";

  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role === "system" ? "system" : m.role,
        content: m.content,
      })),
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) callbacks.onToken(json.message.content);
        if (json.done) return;
      } catch { /* skip malformed chunks */ }
    }
  }
}

// ── Gemini Direct ──────────────────────────────────────────────────

async function streamGeminiChat(
  messages: ChatMessage[],
  callbacks: ChatStreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API key is not set");

  const systemMessage = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const contents = userMessages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMessage?.content || SYSTEM_PROMPT }] },
        contents,
      }),
    }
  );

  if (!response.ok || !response.body) {
    throw new Error(`Gemini error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
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
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) callbacks.onToken(text);
      } catch { /* skip */ }
    }
  }
}

// ── Server Route Fallback ──────────────────────────────────────────

async function streamServerChat(
  messages: ChatMessage[],
  callbacks: ChatStreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const basePath = process.env.__NEXT_ROUTER_BASEPATH || "";
  const url = `${basePath}/api/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ messages }),
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
        if (parsed.type === "token" && parsed.content) callbacks.onToken(parsed.content);
        else if (parsed.type === "error") callbacks.onError(parsed.error);
      } catch { /* skip */ }
    }
  }
}
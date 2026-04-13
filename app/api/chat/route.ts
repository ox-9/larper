import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

type AIProvider = "ollama" | "openai" | "anthropic" | "gemini";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER as AIProvider;
  if (provider && ["ollama", "openai", "anthropic", "gemini"].includes(provider)) {
    return provider;
  }
  return "ollama";
}

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

// ── Streaming helpers ──────────────────────────────────────────────────

function encodeSSE(data: string): Uint8Array {
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

function encodeDone(): Uint8Array {
  return new TextEncoder().encode("data: [DONE]\n\n");
}

async function* streamOllama(messages: ChatMessage[]): AsyncGenerator<string> {
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.1",
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
        if (json.message?.content) yield json.message.content;
        if (json.done) return;
      } catch { /* skip malformed chunks */ }
    }
  }
}

async function* streamOpenAI(messages: ChatMessage[]): AsyncGenerator<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const stream = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    })),
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* streamAnthropic(messages: ChatMessage[]): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";

  const systemMessage = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemMessage?.content || SYSTEM_PROMPT,
    messages: userMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

async function* streamGemini(messages: ChatMessage[]): AsyncGenerator<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");

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
        if (text) yield text;
      } catch { /* skip */ }
    }
  }
}

async function* generateChatStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const provider = getAIProvider();
  switch (provider) {
    case "ollama": yield* streamOllama(messages); break;
    case "openai": yield* streamOpenAI(messages); break;
    case "anthropic": yield* streamAnthropic(messages); break;
    case "gemini": yield* streamGemini(messages); break;
    default: throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: "Messages array is required" },
        { status: 400 }
      );
    }

    const messagesWithSystem: ChatMessage[] =
      messages[0]?.role === "system"
        ? messages
        : [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // Stream the response using SSE
    const stream = new ReadableStream({
      async start(controller) {
        const provider = getAIProvider();
        try {
          for await (const chunk of generateChatStream(messagesWithSystem)) {
            controller.enqueue(encodeSSE(JSON.stringify({ type: "token", content: chunk })));
          }
          controller.enqueue(encodeSSE(JSON.stringify({ type: "done", provider })));
          controller.enqueue(encodeDone());
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate")) {
            controller.enqueue(encodeSSE(JSON.stringify({ type: "error", error: "API rate limit reached. Please wait a moment and try again." })));
          } else {
            controller.enqueue(encodeSSE(JSON.stringify({ type: "error", error: errorMessage })));
          }
          controller.enqueue(encodeDone());
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat generation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
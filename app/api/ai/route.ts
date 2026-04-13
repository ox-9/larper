import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

type AIProvider = "ollama" | "openai" | "anthropic" | "gemini";

function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER as AIProvider;
  if (provider && ["ollama", "openai", "anthropic", "gemini"].includes(provider)) {
    return provider;
  }
  return "ollama";
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

// Generate content using Ollama (free, local)
async function generateWithOllama(prompt: string, systemPrompt?: string): Promise<string> {
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.1",
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: prompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.message?.content || "";
}

// Generate content using OpenAI
async function generateWithOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await client.chat.completions.create({
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user" as const, content: prompt },
    ],
  });

  return response.choices[0]?.message?.content || "";
}

// Generate content using Anthropic Claude
async function generateWithAnthropic(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt || "",
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock ? (textBlock as { type: "text"; text: string }).text : "";
}

// Generate content using Gemini
async function generateWithGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            ...(systemPrompt ? [{ text: systemPrompt }] : []),
            { text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// Unified generate function
async function generate(prompt: string, systemPrompt?: string): Promise<string> {
  const provider = getAIProvider();

  switch (provider) {
    case "ollama":
      return generateWithOllama(prompt, systemPrompt);
    case "openai":
      return generateWithOpenAI(prompt, systemPrompt);
    case "anthropic":
      return generateWithAnthropic(prompt, systemPrompt);
    case "gemini":
      return generateWithGemini(prompt, systemPrompt);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, systemPrompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Missing prompt" },
        { status: 400 }
      );
    }

    const result = await retryWithBackoff(async () => {
      return await generate(prompt, systemPrompt);
    });

    return NextResponse.json({
      success: true,
      result,
      provider: getAIProvider(),
    });
  } catch (error) {
    console.error("AI generation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return NextResponse.json(
        { success: false, error: "API rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
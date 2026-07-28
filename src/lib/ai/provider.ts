import type { AIProvider, AIProviderConfig, AIMessage, AIResponse } from "@/types/scheduler";

// ─── NVIDIA NIM ─────────────────────────────────────────────────────────────

async function callNvidia(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse> {
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    provider: "nvidia",
    model: config.model,
    tokensUsed: data.usage?.total_tokens,
  };
}

// ─── OPENAI ─────────────────────────────────────────────────────────────────

async function callOpenAI(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    provider: "openai",
    model: config.model,
    tokensUsed: data.usage?.total_tokens,
  };
}

// ─── OLLAMA ─────────────────────────────────────────────────────────────────

async function callOllama(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse> {
  const baseUrl = config.baseUrl || "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.message.content,
    provider: "ollama",
    model: config.model,
    tokensUsed: data.eval_count,
  };
}

// ─── UNIFIED CALLER ─────────────────────────────────────────────────────────

export async function callAI(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse> {
  switch (config.provider) {
    case "nvidia":
      return callNvidia(messages, config);
    case "openai":
      return callOpenAI(messages, config);
    case "ollama":
      return callOllama(messages, config);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

// ─── DEFAULT CONFIG FROM ENV ────────────────────────────────────────────────

export function getDefaultAIConfig(): AIProviderConfig {
  const provider = (process.env.AI_PROVIDER || "nvidia") as AIProvider;

  switch (provider) {
    case "nvidia":
      return {
        provider: "nvidia",
        apiKey: process.env.NVIDIA_API_KEY,
        model: process.env.AI_MODEL || "meta/llama-3.1-8b-instruct",
      };
    case "openai":
      return {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.AI_MODEL || "gpt-4o-mini",
      };
    case "ollama":
      return {
        provider: "ollama",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        model: process.env.AI_MODEL || "llama3.1:8b",
      };
    default:
      return {
        provider: "nvidia",
        apiKey: process.env.NVIDIA_API_KEY,
        model: "meta/llama-3.1-8b-instruct",
      };
  }
}

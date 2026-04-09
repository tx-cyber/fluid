import "server-only";

import {
  buildMockSupportAnswer,
  buildOperatorSupportSystemPrompt,
  type OperatorSupportContext,
  type SupportChatMessage,
} from "./shared";

export type AiSupportProvider = "openai" | "local" | "mock";

export interface AiSupportSettings {
  provider: AiSupportProvider;
  model: string;
  baseUrl: string;
  apiKey: string | null;
}

function getRequiredBaseUrl(provider: AiSupportProvider) {
  if (provider === "openai") {
    return "https://api.openai.com/v1";
  }

  if (provider === "local") {
    return (
      process.env.AI_SUPPORT_LOCAL_BASE_URL?.trim().replace(/\/$/, "") ??
      "http://127.0.0.1:11434/v1"
    );
  }

  return "mock://local";
}

export function getAiSupportSettings(): AiSupportSettings {
  const rawProvider = process.env.AI_SUPPORT_PROVIDER?.trim().toLowerCase();
  const provider: AiSupportProvider =
    rawProvider === "local" || rawProvider === "mock" ? rawProvider : "openai";

  return {
    provider,
    model:
      process.env.AI_SUPPORT_MODEL?.trim() ??
      (provider === "local" ? "llama3.1" : "gpt-4.1-mini"),
    baseUrl: getRequiredBaseUrl(provider),
    apiKey:
      provider === "openai"
        ? process.env.OPENAI_API_KEY?.trim() ?? null
        : provider === "local"
          ? process.env.AI_SUPPORT_LOCAL_API_KEY?.trim() ?? "local"
          : null,
  };
}

async function* streamMockAnswer(answer: string) {
  const words = answer.split(/\s+/).filter(Boolean);
  for (const word of words) {
    yield `${word} `;
  }
}

function extractDeltaText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = (payload as {
    choices?: Array<{
      delta?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  }).choices;

  const content = choices?.[0]?.delta?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (entry && typeof entry === "object" && entry.type === "text") {
          return entry.text ?? "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

async function* streamOpenAiCompatibleAnswer(input: {
  settings: AiSupportSettings;
  messages: SupportChatMessage[];
  context: OperatorSupportContext;
}) {
  if (!input.settings.apiKey) {
    throw new Error(
      input.settings.provider === "openai"
        ? "OPENAI_API_KEY is not configured"
        : "AI_SUPPORT_LOCAL_API_KEY is not configured",
    );
  }

  const response = await fetch(`${input.settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.settings.apiKey}`,
    },
    body: JSON.stringify({
      model: input.settings.model,
      temperature: 0.2,
      stream: true,
      messages: [
        {
          role: "system",
          content: buildOperatorSupportSystemPrompt(input.context),
        },
        ...input.messages,
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI request failed with ${response.status}: ${body.slice(0, 240)}`,
    );
  }

  if (!response.body) {
    throw new Error("AI provider did not return a response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const line of dataLines) {
        if (!line || line === "[DONE]") {
          continue;
        }

        const parsed = JSON.parse(line) as unknown;
        const delta = extractDeltaText(parsed);
        if (delta) {
          yield delta;
        }
      }
    }
  }
}

export async function* streamOperatorSupportAnswer(input: {
  settings: AiSupportSettings;
  messages: SupportChatMessage[];
  context: OperatorSupportContext;
}) {
  if (input.settings.provider === "mock") {
    const lastMessage = input.messages.at(-1)?.content ?? "No question supplied";
    yield* streamMockAnswer(buildMockSupportAnswer(input.context, lastMessage));
    return;
  }

  yield* streamOpenAiCompatibleAnswer(input);
}

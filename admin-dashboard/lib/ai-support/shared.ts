export type SupportChatRole = "user" | "assistant";

export interface SupportChatMessage {
  role: SupportChatRole;
  content: string;
}

export interface SupportDocumentChunk {
  id: string;
  title: string;
  source: string;
  content: string;
  score: number;
}

export interface SupportTransactionContext {
  id: string;
  tenantId: string;
  status: string;
  category: string;
  createdAt: string;
  hash: string;
  costStroops: number | null;
}

export interface SupportNodeConfig {
  dashboardUrl: string | null;
  fluidServerUrl: string | null;
  docsUrl: string | null;
  sandboxHorizonUrl: string | null;
  aiProvider: string;
  aiModel: string;
  adminTokenConfigured: boolean;
  healthStatus: string | null;
  network: string | null;
  horizonUrl: string | null;
  feePayerStates: string[];
}

export interface OperatorSupportContext {
  adminEmail: string;
  docs: SupportDocumentChunk[];
  nodeConfig: SupportNodeConfig;
  recentTransactions: SupportTransactionContext[];
}

interface RawDocument {
  title: string;
  source: string;
  content: string;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

export function sanitizeChatMessages(messages: SupportChatMessage[]) {
  return messages
    .filter((message) => {
      return (
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim().length > 0
      );
    })
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }));
}

export function chunkSupportDocument(
  document: RawDocument,
  maxChunkLength = 900,
): SupportDocumentChunk[] {
  const normalized = document.content.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  const sections = normalized
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks: SupportDocumentChunk[] = [];
  let buffer = "";
  let chunkIndex = 0;

  for (const section of sections) {
    const next = buffer ? `${buffer}\n\n${section}` : section;
    if (next.length <= maxChunkLength) {
      buffer = next;
      continue;
    }

    if (buffer) {
      chunkIndex += 1;
      chunks.push({
        id: `${document.source}#${chunkIndex}`,
        title: document.title,
        source: document.source,
        content: buffer,
        score: 0,
      });
      buffer = "";
    }

    if (section.length <= maxChunkLength) {
      buffer = section;
      continue;
    }

    for (let offset = 0; offset < section.length; offset += maxChunkLength) {
      chunkIndex += 1;
      chunks.push({
        id: `${document.source}#${chunkIndex}`,
        title: document.title,
        source: document.source,
        content: section.slice(offset, offset + maxChunkLength),
        score: 0,
      });
    }
  }

  if (buffer) {
    chunkIndex += 1;
    chunks.push({
      id: `${document.source}#${chunkIndex}`,
      title: document.title,
      source: document.source,
      content: buffer,
      score: 0,
    });
  }

  return chunks;
}

export function selectRelevantSupportChunks(
  query: string,
  chunks: SupportDocumentChunk[],
  limit = 4,
) {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) {
    return chunks.slice(0, limit).map((chunk, index) => ({
      ...chunk,
      score: limit - index,
    }));
  }

  return chunks
    .map((chunk) => {
      const contentTokens = tokenize(`${chunk.title} ${chunk.content}`);
      let score = 0;
      for (const token of contentTokens) {
        if (queryTokens.has(token)) {
          score += 1;
        }
      }

      return { ...chunk, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.source.localeCompare(right.source);
    })
    .slice(0, limit);
}

export function buildOperatorSupportSystemPrompt(
  context: OperatorSupportContext,
) {
  const docsBlock = context.docs
    .map((chunk) => {
      return `[${chunk.title} | ${chunk.source}]\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  const configBlock = JSON.stringify(context.nodeConfig, null, 2);
  const txBlock = JSON.stringify(context.recentTransactions, null, 2);

  return [
    "You are Fluid's embedded dashboard support assistant for node operators.",
    "Answer using the supplied docs, node configuration snapshot, and recent transaction history.",
    "If the answer is not supported by the provided context, say what is missing instead of inventing details.",
    "Keep answers concise, practical, and operator-focused.",
    `Current admin session: ${context.adminEmail}`,
    "",
    "Relevant documentation excerpts:",
    docsBlock || "No documentation excerpts were available.",
    "",
    "Current node configuration snapshot:",
    configBlock,
    "",
    "Last 100 transactions (or best available subset):",
    txBlock,
  ].join("\n");
}

export function buildMockSupportAnswer(
  context: OperatorSupportContext,
  query: string,
) {
  const latestTransaction = context.recentTransactions[0];
  const feePayerSummary =
    context.nodeConfig.feePayerStates.length > 0
      ? context.nodeConfig.feePayerStates.join(", ")
      : "No live fee payer status was available.";
  const docsSummary =
    context.docs.length > 0
      ? context.docs.map((chunk) => chunk.title).join(", ")
      : "No documentation snippets were selected.";

  return [
    `Mock support mode is active, so this answer is generated from the injected dashboard context for: "${query}".`,
    `Node status: ${context.nodeConfig.healthStatus ?? "unknown"} on ${context.nodeConfig.network ?? "unknown network"}.`,
    `Fee payer state: ${feePayerSummary}`,
    latestTransaction
      ? `Most recent transaction: ${latestTransaction.category} for tenant ${latestTransaction.tenantId} with status ${latestTransaction.status} at ${latestTransaction.createdAt}.`
      : "No recent transactions were available in context.",
    `Documentation sources consulted: ${docsSummary}.`,
  ].join(" ");
}

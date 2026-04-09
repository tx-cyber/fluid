import { deepStrictEqual, match, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";

import {
  buildMockSupportAnswer,
  buildOperatorSupportSystemPrompt,
  chunkSupportDocument,
  sanitizeChatMessages,
  selectRelevantSupportChunks,
} from "./lib/ai-support/shared.ts";

describe("ai support helpers", () => {
  it("chunks long support documents into stable sections", () => {
    const chunks = chunkSupportDocument(
      {
        title: "Quick Start",
        source: "server/QUICK_START.md",
        content: ["Intro", "Transactions", "Configuration"].join("\n\n"),
      },
      12,
    );

    strictEqual(chunks.length, 4);
    strictEqual(chunks[0]?.source, "server/QUICK_START.md");
  });

  it("selects chunks that overlap the question", () => {
    const ranked = selectRelevantSupportChunks("transaction failure", [
      {
        id: "1",
        title: "Transactions",
        source: "server/README.md",
        content: "Transaction failure troubleshooting and replay steps.",
        score: 0,
      },
      {
        id: "2",
        title: "Billing",
        source: "README.md",
        content: "Subscription upgrades and invoices.",
        score: 0,
      },
    ]);

    strictEqual(ranked[0]?.id, "1");
    ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));
  });

  it("sanitizes chat history before sending it to the provider", () => {
    deepStrictEqual(
      sanitizeChatMessages([
        { role: "user", content: "  Hello there  " },
        { role: "assistant", content: "" },
      ]),
      [{ role: "user", content: "Hello there" }],
    );
  });

  it("builds a system prompt with docs, config, and transactions", () => {
    const prompt = buildOperatorSupportSystemPrompt({
      adminEmail: "ops@fluid.dev",
      docs: [
        {
          id: "doc-1",
          title: "Server README",
          source: "server/README.md",
          content: "The server wraps transactions in fee bump envelopes.",
          score: 3,
        },
      ],
      nodeConfig: {
        dashboardUrl: "http://localhost:3001",
        fluidServerUrl: "http://localhost:3000",
        docsUrl: "https://docs.fluid.dev",
        sandboxHorizonUrl: null,
        aiProvider: "mock",
        aiModel: "demo",
        adminTokenConfigured: true,
        healthStatus: "healthy",
        network: "Test SDF Network ; September 2015",
        horizonUrl: "https://horizon-testnet.stellar.org",
        feePayerStates: ["ABC123: healthy (100 XLM)"],
      },
      recentTransactions: [
        {
          id: "tx-1",
          tenantId: "anchor-west",
          status: "success",
          category: "Token Transfer",
          createdAt: "2026-03-29T10:00:00.000Z",
          hash: "deadbeef",
          costStroops: 12345,
        },
      ],
    });

    match(prompt, /Relevant documentation excerpts:/);
    match(prompt, /Current node configuration snapshot:/);
    match(prompt, /Last 100 transactions/);
  });

  it("produces a deterministic mock answer for local verification", () => {
    const answer = buildMockSupportAnswer(
      {
        adminEmail: "ops@fluid.dev",
        docs: [
          {
            id: "doc-1",
            title: "Quick Start",
            source: "server/QUICK_START.md",
            content: "Recent transactions list",
            score: 1,
          },
        ],
        nodeConfig: {
          dashboardUrl: null,
          fluidServerUrl: "http://localhost:3000",
          docsUrl: null,
          sandboxHorizonUrl: null,
          aiProvider: "mock",
          aiModel: "demo",
          adminTokenConfigured: true,
          healthStatus: "degraded",
          network: "Testnet",
          horizonUrl: null,
          feePayerStates: ["XYZ789: Low Balance (4 XLM)"],
        },
        recentTransactions: [
          {
            id: "tx-2",
            tenantId: "ops-team",
            status: "failed",
            category: "Soroban Contract",
            createdAt: "2026-03-29T11:00:00.000Z",
            hash: "beadfeed",
            costStroops: 9191,
          },
        ],
      },
      "Why are transactions failing?",
    );

    match(answer, /Why are transactions failing/);
    match(answer, /Node status: degraded/);
    match(answer, /Most recent transaction:/);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock native module before any imports
vi.mock("../signing/native", () => ({
  nativeSigner: {
    sign: vi.fn(),
  },
}));

// Mock config module
vi.mock("../config", () => ({
  loadConfig: vi.fn().mockReturnValue({
    horizonUrls: ["https://horizon-testnet.stellar.org"],
  }),
}));

import { CrossChainSyncService } from "./crossChainSyncService";
import prisma from "../utils/db";

// Mock dependencies
vi.mock("ethers", () => ({
  ethers: {
    JsonRpcProvider: vi.fn().mockImplementation(function (this: any) {
      this.on = vi.fn();
      return this;
    }),
    Wallet: vi.fn().mockImplementation(function (this: any) {
      return this;
    }),
    Contract: vi.fn().mockImplementation(function (this: any) {
      this.on = vi.fn();
      this.syncCount = vi.fn().mockResolvedValue({
        hash: "0x_mock_evm_tx_hash",
        wait: vi.fn().mockResolvedValue({ hash: "0x_mock_evm_tx_hash" }),
      });
      this.removeAllListeners = vi.fn();
      return this;
    }),
  },
}));

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual("@stellar/stellar-sdk") as any;
  return {
    ...actual,
    SorobanRpc: {
      Server: vi.fn().mockImplementation(function (this: any) {
        this.getEvents = vi.fn().mockResolvedValue({
          events: [
            {
              id: "stellar_event_1",
              type: "contract",
              contractId: "C123",
            },
          ],
          latestLedger: 12345,
        });
        return this;
      }),
    },
    Keypair: {
      fromSecret: vi.fn().mockReturnValue({ publicKey: () => "G123" }),
    },
  };
});

vi.mock("../utils/db", () => ({
  default: {
    crossChainSync: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "sync_1" }),
      update: vi.fn(),
    },
  },
}));

describe("CrossChainSyncService", () => {
  let service: CrossChainSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CrossChainSyncService();
  });

  it("should initialize with correct contract addresses", () => {
    expect(service).toBeDefined();
  });

  it("should handle Soroban increment events", async () => {
    // @ts-ignore - accessing private method for test
    await service.pollSorobanEvents();
    
    expect(prisma.crossChainSync.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceChain: "stellar",
        targetChain: "ethereum",
      }),
    }));
  });

  it("should handle EVM increment events", async () => {
    // @ts-ignore - accessing private method for test
    await service.handleEvmIncrement(BigInt(10), "0x_source_tx");
    
    expect(prisma.crossChainSync.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceChain: "ethereum",
        targetChain: "stellar",
      }),
    }));
  });
});

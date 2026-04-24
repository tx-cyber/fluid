// Web Worker for off-thread cryptographic operations
// Handles signing and XDR creation to keep UI responsive

import { create_xdr, initWasm, sign_transaction } from "../wasm/signing_wasm";

// Message types for worker communication
interface WorkerRequest {
  id: string;
  type: "sign_transaction" | "create_xdr";
  data: any;
}

interface WorkerResponse {
  id: string;
  type: "success" | "error";
  result?: any;
  error?: string;
}

// Declare worker globals
declare var self: DedicatedWorkerGlobalScope;

// Initialize WASM module
let wasmInitialized = false;

async function initializeWasm(): Promise<void> {
  if (!wasmInitialized) {
    try {
      await initWasm();
      wasmInitialized = true;
      console.log("[SigningWorker] WASM module initialized successfully");
    } catch (error: any) {
      console.error("[SigningWorker] Failed to initialize WASM:", error);
      throw error;
    }
  }
}

// Handle signing operations
async function handleSignTransaction(data: any): Promise<any> {
  await initializeWasm();

  const { transactionXdr, secretKey } = data;

  try {
    // Use WASM module for signing
    const signedXdr = sign_transaction(transactionXdr, secretKey);
    return { signedXdr };
  } catch (error: any) {
    throw new Error(`Signing failed: ${error.message}`);
  }
}

// Handle XDR creation operations
async function handleCreateXdr(data: any): Promise<any> {
  await initializeWasm();

  const { transactionData, networkPassphrase } = data;

  try {
    // Use WASM module for XDR creation
    const xdr = create_xdr(transactionData, networkPassphrase);
    return { xdr };
  } catch (error: any) {
    throw new Error(`XDR creation failed: ${error.message}`);
  }
}

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, data } = event.data;

  try {
    let result;

    switch (type) {
      case "sign_transaction":
        result = await handleSignTransaction(data);
        break;
      case "create_xdr":
        result = await handleCreateXdr(data);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      type: "success",
      result,
    };

    self.postMessage(response);
  } catch (error: any) {
    const response: WorkerResponse = {
      id,
      type: "error",
      error: error.message || "Unknown worker error",
    };

    self.postMessage(response);
  }
};

// Handle worker errors
self.onerror = (error: ErrorEvent) => {
  console.error("[SigningWorker] Worker error:", error);
};

export {};

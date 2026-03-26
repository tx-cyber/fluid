import StellarSdk, { Horizon, Transaction, FeeBumpTransaction } from "@stellar/stellar-sdk";

export interface FluidClientConfig {
  serverUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
}

export interface FeeBumpResponse {
  xdr: string;
  status: "ready" | "submitted";
  hash?: string;
  fee_payer?: string;
  submitted_via?: string;
  submission_attempts?: number;
}

export interface FeeBumpRequestBody {
  xdr: string;
  submit?: boolean;
}

export type XdrSerializableTransaction = {
  toXDR: () => string;
};

export type FeeBumpRequestInput = string | XdrSerializableTransaction;

export class FluidClient {
  private readonly serverUrl: string;
  private readonly networkPassphrase: string;
  private readonly horizonServer?: Horizon.Server;

  constructor(config: FluidClientConfig) {
    this.serverUrl = config.serverUrl.replace(/\/+$/, "");
    this.networkPassphrase = config.networkPassphrase;

    if (config.horizonUrl) {
      this.horizonServer = new StellarSdk.Horizon.Server(config.horizonUrl);
    }
  }

  private serializeTransaction(input: FeeBumpRequestInput): string {
    return typeof input === "string" ? input : input.toXDR();
  }

  async requestFeeBump(
    transaction: FeeBumpRequestInput,
    submit: boolean = false
  ): Promise<FeeBumpResponse> {
    const response = await fetch(`${this.serverUrl}/fee-bump`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        xdr: this.serializeTransaction(transaction),
        submit,
      } satisfies FeeBumpRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      try {
        const parsed = JSON.parse(errorText) as Record<string, unknown>;
        throw new Error(`Fluid server error: ${JSON.stringify(parsed)}`);
      } catch {
        throw new Error(
          `Fluid server error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
        );
      }
    }

    return (await response.json()) as FeeBumpResponse;
  }

  async submitFeeBumpTransaction(
    feeBumpXdr: string
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
    if (!this.horizonServer) {
      throw new Error("Horizon URL not configured");
    }

    const feeBumpTx = StellarSdk.TransactionBuilder.fromXDR(
      feeBumpXdr,
      this.networkPassphrase
    ) as Transaction | FeeBumpTransaction;

    return this.horizonServer.submitTransaction(feeBumpTx);
  }

  async buildAndRequestFeeBump(
    transaction: XdrSerializableTransaction,
    submit: boolean = false
  ): Promise<FeeBumpResponse> {
    return this.requestFeeBump(transaction, submit);
  }
}

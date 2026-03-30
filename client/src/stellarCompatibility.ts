export interface StellarSdkModuleLike {
  default?: unknown;
  Horizon?: {
    Server?: new (serverUrl: string) => unknown;
  };
  Server?: new (serverUrl: string) => unknown;
  TransactionBuilder?: {
    fromXDR?: (xdr: string, networkPassphrase: string) => unknown;
    buildFeeBumpTransaction?: (
      feeSource: string,
      baseFee: string,
      innerTransaction: unknown,
      networkPassphrase: string
    ) => unknown;
  };
}

export interface StellarTransactionLike {
  toXDR?: (format?: string) => string;
  toEnvelope?: () => {
    toXDR?: (format?: string) => string;
  };
  signatures?: unknown[];
  fee?: string;
  operations?: unknown[];
}

export interface FeeBumpBuildOptions {
  feeSource: string | { publicKey: () => string };
  baseFee: string | number;
  innerTransaction: StellarTransactionLike;
  networkPassphrase: string;
}

export function resolveStellarSdk(input: unknown): StellarSdkModuleLike {
  const candidate = (input ?? {}) as StellarSdkModuleLike;
  const defaultExport = candidate.default as StellarSdkModuleLike | undefined;

  if (hasTransactionBuilder(candidate)) {
    return candidate;
  }

  if (hasTransactionBuilder(defaultExport)) {
    return defaultExport;
  }

  throw new Error(
    "Unsupported Stellar SDK module: expected TransactionBuilder on the module or its default export"
  );
}

export function getSdkFamily(input: unknown): "legacy" | "scoped" {
  const sdk = resolveStellarSdk(input);
  return sdk.Server ? "legacy" : "scoped";
}

export function isTransactionLike(value: unknown): value is StellarTransactionLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const tx = value as StellarTransactionLike;
  return typeof tx.toXDR === "function" || typeof tx.toEnvelope === "function";
}

export function toTransactionXdr(transaction: unknown): string {
  if (!isTransactionLike(transaction)) {
    throw new Error("Unsupported transaction object: expected toXDR() or toEnvelope().toXDR()");
  }

  if (typeof transaction.toXDR === "function") {
    return transaction.toXDR();
  }

  const envelope = transaction.toEnvelope?.();
  if (envelope && typeof envelope.toXDR === "function") {
    return envelope.toXDR("base64");
  }

  throw new Error("Unsupported transaction object: unable to derive XDR");
}

export function fromTransactionXdr(
  sdkInput: unknown,
  xdr: string,
  networkPassphrase: string
): unknown {
  const sdk = resolveStellarSdk(sdkInput);
  const fromXDR = sdk.TransactionBuilder?.fromXDR;

  if (typeof fromXDR !== "function") {
    throw new Error("Unsupported Stellar SDK module: TransactionBuilder.fromXDR() is unavailable");
  }

  return fromXDR(xdr, networkPassphrase);
}

export function buildFeeBumpTransaction(
  sdkInput: unknown,
  options: FeeBumpBuildOptions
): unknown {
  const sdk = resolveStellarSdk(sdkInput);
  const builder = sdk.TransactionBuilder?.buildFeeBumpTransaction;

  if (typeof builder !== "function") {
    throw new Error(
      "Unsupported Stellar SDK module: TransactionBuilder.buildFeeBumpTransaction() is unavailable"
    );
  }

  const feeSource =
    typeof options.feeSource === "string"
      ? options.feeSource
      : options.feeSource.publicKey();

  return builder(
    feeSource,
    String(options.baseFee),
    options.innerTransaction,
    options.networkPassphrase
  );
}

export function createHorizonServer(
  sdkInput: unknown,
  horizonUrl: string
): unknown {
  const sdk = resolveStellarSdk(sdkInput);
  const ServerCtor = sdk.Server ?? sdk.Horizon?.Server;

  if (!ServerCtor) {
    throw new Error("Unsupported Stellar SDK module: Horizon server constructor is unavailable");
  }

  return new ServerCtor(horizonUrl);
}

function hasTransactionBuilder(value: unknown): value is StellarSdkModuleLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      (typeof (value as StellarSdkModuleLike).TransactionBuilder === "object" ||
        typeof (value as StellarSdkModuleLike).TransactionBuilder === "function")
  );
}

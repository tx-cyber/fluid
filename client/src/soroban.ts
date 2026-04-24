import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Memo,
  nativeToScVal,
  SorobanRpc,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

export interface IssuedAssetInput {
  code: string;
  issuer: string;
}

export type SacAssetInput =
  | Asset
  | IssuedAssetInput
  | "native"
  | "xlm"
  | `${string}:${string}`;

export interface BuildSACTransferTxOptions {
  source: string;
  destination: string;
  asset: SacAssetInput;
  amount: string | number | bigint;
  networkPassphrase: string;
  sorobanRpcUrl?: string;
  sorobanServer?: SorobanRpc.Server;
  timeoutInSeconds?: number;
  fee?: string | number;
  memo?: Memo;
  sourceAccount?: Account;
}

export interface ResolvedSacAsset {
  asset: Asset;
  contractId: string;
  isNative: boolean;
}

function normalizeAsset(assetInput: SacAssetInput): Asset {
  if (assetInput instanceof Asset) {
    return assetInput;
  }

  if (typeof assetInput === "string") {
    const normalized = assetInput.trim();
    const lowered = normalized.toLowerCase();

    if (lowered === "native" || lowered === "xlm") {
      return Asset.native();
    }

    const [code, issuer, ...rest] = normalized.split(":");
    if (!code || !issuer || rest.length > 0) {
      throw new Error(
        "Issued SAC assets must use the canonical CODE:ISSUER format"
      );
    }

    return new Asset(code, issuer);
  }

  return new Asset(assetInput.code, assetInput.issuer);
}

function normalizeAmount(amount: string | number | bigint): bigint {
  if (typeof amount === "bigint") {
    return amount;
  }

  if (typeof amount === "number") {
    if (!Number.isSafeInteger(amount)) {
      throw new Error(
        "SAC transfer amounts must be integer base units and fit in a safe integer"
      );
    }
    return BigInt(amount);
  }

  if (amount.includes(".")) {
    throw new Error(
      "SAC transfer amounts must be provided in integer base units, not decimal strings"
    );
  }

  return BigInt(amount);
}

function normalizeAddress(address: string | Address): Address {
  if (address instanceof Address) {
    return address;
  }

  return new Address(address);
}

export function resolveSacAsset(
  assetInput: SacAssetInput,
  networkPassphrase: string
): ResolvedSacAsset {
  const asset = normalizeAsset(assetInput);
  return {
    asset,
    contractId: asset.contractId(networkPassphrase),
    isNative: asset.isNative(),
  };
}

export function buildSACTransferOperation(
  source: string | Address,
  destination: string | Address,
  assetInput: SacAssetInput,
  amount: string | number | bigint,
  networkPassphrase: string
): xdr.Operation {
  const sourceAddress = normalizeAddress(source);
  const destinationAddress = normalizeAddress(destination);
  const resolvedAsset = resolveSacAsset(assetInput, networkPassphrase);
  const contract = new Contract(resolvedAsset.contractId);

  return contract.call(
    "transfer",
    sourceAddress.toScVal(),
    destinationAddress.toScVal(),
    nativeToScVal(normalizeAmount(amount), { type: "i128" })
  );
}

export async function buildSACTransferTx(
  options: BuildSACTransferTxOptions
): Promise<Transaction> {
  const sorobanServer =
    options.sorobanServer ??
    (options.sorobanRpcUrl
      ? new SorobanRpc.Server(options.sorobanRpcUrl)
      : undefined);

  if (!sorobanServer) {
    throw new Error(
      "Soroban RPC URL is required to prepare an SAC transfer transaction"
    );
  }

  const sourceAccount =
    options.sourceAccount ?? (await sorobanServer.getAccount(options.source));
  const builder = new TransactionBuilder(sourceAccount, {
    fee: String(options.fee ?? BASE_FEE),
    networkPassphrase: options.networkPassphrase,
  });

  if (options.memo) {
    builder.addMemo(options.memo);
  }

  const rawTransaction = builder
    .addOperation(
      buildSACTransferOperation(
        options.source,
        options.destination,
        options.asset,
        options.amount,
        options.networkPassphrase
      )
    )
    .setTimeout(options.timeoutInSeconds ?? 180)
    .build();

  return sorobanServer.prepareTransaction(rawTransaction);
}

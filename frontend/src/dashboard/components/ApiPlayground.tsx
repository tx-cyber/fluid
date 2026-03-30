import React from "react";
import * as StellarSdk from "@stellar/stellar-sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DecodedOp {
  type: string;
  source?: string;
  [key: string]: unknown;
}

interface DecodedTx {
  hash: string;
  fee: string;
  sequenceNumber: string;
  sourceAccount: string;
  operations: DecodedOp[];
  signatures: number;
  memo: string;
}

interface PlaygroundResponse {
  ok: boolean;
  receivedAt?: string;
  network?: string;
  decoded?: DecodedTx;
  feeBumpXdr?: string;
  feeBumpHash?: string;
  feePayer?: string;
  submitted?: boolean;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
  code?: string;
  details?: unknown;
}

interface ImportedContractParameter {
  name: string;
  type: string;
  doc?: string;
}

interface ImportedContractFunction {
  name: string;
  doc?: string;
  parameters: ImportedContractParameter[];
  outputs: string[];
  sampleXdr: string;
}

interface ContractImportResponse {
  ok: boolean;
  receivedAt?: string;
  sourceUrl?: string;
  apiUrl?: string;
  wasmUrl?: string;
  network?: "public" | "testnet";
  contractId?: string;
  wasmHash?: string;
  creator?: string;
  validation?: {
    status?: string;
    repository?: string;
    commit?: string;
    ts?: number;
  };
  functions?: ImportedContractFunction[];
  error?: string;
  code?: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE =
  "Public Global Stellar Network ; September 2015";

// Vite exposes env vars via import.meta.env at build time.
// We cast through unknown to avoid the IDE not having vite/client types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

const SANDBOX_API_KEY =
  _viteEnv.VITE_PLAYGROUND_SANDBOX_API_KEY || "sbx_playground_demo_key";

const PLAYGROUND_API_URL =
  _viteEnv.VITE_PLAYGROUND_API_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildExampleSignedXdr(network: "testnet" | "mainnet"): string {
  const passphrase =
    network === "mainnet" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;
  const sourceKp = StellarSdk.Keypair.fromSecret(
    // gitleaks:allow
    "S" + "DDXWE2JG2VL7NU3EQ5CRJWXPIYSYNBSUBRA2MHQLAERV5CGSGDMXZFY"
  );
  const tx = new StellarSdk.TransactionBuilder(
    new StellarSdk.Account(sourceKp.publicKey(), "1000000"),
    { fee: "100", networkPassphrase: passphrase }
  )
    .addOperation(
      StellarSdk.Operation.payment({
        destination: "GCCAXCM6VOXWFM2BHNFI7FEYAQ46M6NUW5XMP5TKL6LN52XW4KRMLFA2",
        asset: StellarSdk.Asset.native(),
        amount: "10",
      })
    )
    .setTimeout(30)
    .build();
  tx.sign(sourceKp);
  return tx.toXDR();
}

function decodeXdrClientSide(
  xdr: string,
  network: "testnet" | "mainnet"
): DecodedTx {
  const passphrase =
    network === "mainnet" ? MAINNET_PASSPHRASE : TESTNET_PASSPHRASE;
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    xdr,
    passphrase
  ) as StellarSdk.Transaction;

  const ops: DecodedOp[] = tx.operations.map((op) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { type, source, ...rest } = op as any;
    return { type, source, ...rest };
  });

  let memoStr = "none";
  if (tx.memo && tx.memo.type !== "none") {
    memoStr = tx.memo.type;
    if ("value" in tx.memo && tx.memo.value != null) {
      memoStr += `:${tx.memo.value.toString()}`;
    }
  }

  return {
    hash: tx.hash().toString("hex"),
    fee: tx.fee,
    sequenceNumber: tx.sequence,
    sourceAccount: tx.source,
    operations: ops,
    signatures: tx.signatures.length,
    memo: memoStr,
  };
}

function truncate(s: string, n = 24): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function mapExplorerNetworkToPlayground(
  network: "public" | "testnet"
): "mainnet" | "testnet" {
  return network === "public" ? "mainnet" : "testnet";
}

// ---------------------------------------------------------------------------
// Sub-components (all inline, no external deps besides stellar-sdk)
// ---------------------------------------------------------------------------

const colors = {
  bg: "rgba(15,23,42,0.0)",
  panelBg: "linear-gradient(160deg,rgba(15,23,42,0.72) 0%,rgba(22,32,54,0.6) 100%)",
  border: "rgba(226,232,240,0.12)",
  borderActive: "rgba(56,189,248,0.5)",
  text: "#e2e8f0",
  muted: "rgba(203,213,225,0.65)",
  accent: "#38bdf8",
  accentDark: "#0891b2",
  green: "#34d399",
  red: "#f87171",
  yellow: "#fbbf24",
  codeBg: "rgba(2,6,23,0.72)",
};

function Badge({
  children,
  color = "accent",
}: {
  children: React.ReactNode;
  color?: "accent" | "green" | "red" | "yellow";
}) {
  const c = { accent: colors.accent, green: colors.green, red: colors.red, yellow: colors.yellow }[color];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: `${c}20`,
        color: c,
        border: `1px solid ${c}44`,
      }}
    >
      {children}
    </span>
  );
}

function CodeBlock({
  value,
  label,
  maxHeight = 320,
}: {
  value: string;
  label?: string;
  maxHeight?: number;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ position: "relative" }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: colors.muted,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <pre
          style={{
            margin: 0,
            padding: "14px 16px",
            borderRadius: 12,
            background: colors.codeBg,
            border: `1px solid ${colors.border}`,
            color: "#a5f3fc",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            overflowX: "auto",
            overflowY: "auto",
            maxHeight,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}
        >
          {value}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: copied ? `${colors.green}22` : "rgba(30,41,59,0.8)",
            border: `1px solid ${copied ? colors.green : colors.border}`,
            borderRadius: 6,
            color: copied ? colors.green : colors.muted,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 200ms ease",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function OperationCard({ op, index }: { op: DecodedOp; index: number }) {
  const [open, setOpen] = React.useState(false);
  const { type, source, ...rest } = op;

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        background: "rgba(15,23,42,0.5)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: colors.text,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: `${colors.accent}22`,
            border: `1px solid ${colors.accent}44`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: colors.accent,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {type.replace(/([A-Z])/g, " $1").trim()}
        </span>
        {source && (
          <span style={{ fontSize: 11, color: colors.muted, marginLeft: "auto" }}>
            src: {truncate(source, 16)}
          </span>
        )}
        <span style={{ color: colors.muted, marginLeft: source ? 0 : "auto" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 12px" }}>
          <CodeBlock
            value={JSON.stringify({ type, source, ...rest }, null, 2)}
            maxHeight={180}
          />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: colors.accent,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: colors.panelBg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: "18px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Playground component
// ---------------------------------------------------------------------------

export function ApiPlayground() {
  const [network, setNetwork] = React.useState<"testnet" | "mainnet">("testnet");
  const [xdr, setXdr] = React.useState("");
  const [apiKey, setApiKey] = React.useState(SANDBOX_API_KEY);
  const [submitTx, setSubmitTx] = React.useState(true);
  const [contractUrl, setContractUrl] = React.useState("");
  const [importingContract, setImportingContract] = React.useState(false);
  const [contractImport, setContractImport] =
    React.useState<ContractImportResponse | null>(null);
  const [contractImportError, setContractImportError] = React.useState<string | null>(null);

  const [decoded, setDecoded] = React.useState<DecodedTx | null>(null);
  const [decodeError, setDecodeError] = React.useState<string | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<PlaygroundResponse | null>(null);

  // --------- Build example XDR ---------
  const handleBuildExample = () => {
    try {
      const exampleXdr = buildExampleSignedXdr(network);
      setXdr(exampleXdr);
      setDecoded(null);
      setDecodeError(null);
      setResult(null);
    } catch (e) {
      setDecodeError(
        `Could not generate example XDR: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  // --------- Preview / decode ---------
  const handleDecode = () => {
    setDecodeError(null);
    setDecoded(null);
    if (!xdr.trim()) {
      setDecodeError("Please paste an XDR string or click Build Example first.");
      return;
    }
    try {
      const d = decodeXdrClientSide(xdr.trim(), network);
      setDecoded(d);
    } catch (e) {
      setDecodeError(
        `XDR decode failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  // --------- Fire request ---------
  const handleFire = async () => {
    if (!xdr.trim()) {
      setDecodeError("XDR is required before firing a request.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`${PLAYGROUND_API_URL}/playground/fee-bump`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xdr: xdr.trim(),
          network,
          apiKey: apiKey || undefined,
          submit: submitTx,
        }),
      });
      const json = (await resp.json()) as PlaygroundResponse;
      setResult(json);
      if (json.decoded) setDecoded(json.decoded);
    } catch (e) {
      setResult({
        ok: false,
        error: `Network error: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportContract = async () => {
    if (!contractUrl.trim()) {
      setContractImportError("Paste a Stellar Expert contract URL first.");
      setContractImport(null);
      return;
    }

    setImportingContract(true);
    setContractImportError(null);
    setContractImport(null);

    try {
      const resp = await fetch(`${PLAYGROUND_API_URL}/playground/contract-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: contractUrl.trim() }),
      });
      const json = (await resp.json()) as ContractImportResponse;
      if (!resp.ok || !json.ok) {
        setContractImportError(json.error ?? "Contract import failed.");
        setContractImport(json);
        return;
      }
      setContractImport(json);
    } catch (e) {
      setContractImportError(
        `Contract import failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setImportingContract(false);
    }
  };

  const handleUseSampleXdr = (
    fn: ImportedContractFunction,
    importedNetwork: "public" | "testnet"
  ) => {
    const nextNetwork = mapExplorerNetworkToPlayground(importedNetwork);
    setNetwork(nextNetwork);
    setXdr(fn.sampleXdr);
    setResult(null);
    setDecodeError(null);

    try {
      setDecoded(decodeXdrClientSide(fn.sampleXdr, nextNetwork));
    } catch (e) {
      setDecoded(null);
      setDecodeError(
        `Sample XDR decode failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: colors.codeBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    color: colors.text,
    fontSize: 13,
    padding: "10px 12px",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 200ms ease",
  };

  const btnBase: React.CSSProperties = {
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    padding: "10px 20px",
    transition: "all 200ms ease",
    letterSpacing: "0.01em",
  };

  return (
    <div style={{ color: colors.text, fontFamily: "'Inter', sans-serif" }}>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f8fafc" }}>
            API Playground
          </h1>
          <Badge color="green">Live · Testnet</Badge>
        </div>
        <p style={{ margin: 0, color: colors.muted, fontSize: 14, lineHeight: 1.6 }}>
          Test the <code style={{ color: colors.accent }}>/fee-bump</code> endpoint live — no code
          required. Paste your inner transaction XDR or auto-generate one, preview the decoded
          operations, then fire it against the Testnet node.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* LEFT COLUMN – Inputs                                              */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Network Selector */}
          <Panel>
            <SectionHeader>
              <span>🌐</span> Network
            </SectionHeader>
            <div style={{ display: "flex", gap: 8 }}>
              {(["testnet", "mainnet"] as const).map((n) => (
                <button
                  key={n}
                  id={`network-${n}`}
                  type="button"
                  onClick={() => {
                    setNetwork(n);
                    setDecoded(null);
                    setDecodeError(null);
                    setResult(null);
                    setXdr("");
                  }}
                  style={{
                    ...btnBase,
                    flex: 1,
                    background:
                      network === n
                        ? `linear-gradient(120deg, ${colors.accentDark}55 0%, ${colors.accent}33 100%)`
                        : "rgba(30,41,59,0.5)",
                    border: `1px solid ${network === n ? colors.accent : colors.border}`,
                    color: network === n ? colors.accent : colors.muted,
                    textTransform: "capitalize",
                  }}
                >
                  {n === "testnet" ? "🧪 Testnet" : "🌍 Mainnet"}
                </button>
              ))}
            </div>
            {network === "mainnet" && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: `${colors.yellow}18`,
                  border: `1px solid ${colors.yellow}44`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: colors.yellow,
                }}
              >
                ⚠️ Mainnet selected — submission is disabled in the playground for safety. You
                will receive the ready-to-submit fee-bumped XDR only.
              </div>
            )}
          </Panel>

          <Panel>
            <SectionHeader>
              <span>🧬</span> Soroban Contract Import
            </SectionHeader>

            <p style={{ margin: "0 0 10px", color: colors.muted, fontSize: 13, lineHeight: 1.6 }}>
              Paste a Stellar Expert Soroban contract URL to auto-import the ABI, inspect the
              function signatures, and generate sample inner transaction XDRs in one click.
            </p>

            <div style={{ marginBottom: 10 }}>
              <input
                id="contract-url-input"
                type="url"
                value={contractUrl}
                onChange={(e) => {
                  setContractUrl(e.target.value);
                  setContractImportError(null);
                }}
                placeholder="https://stellar.expert/explorer/public/contract/C..."
                style={inputStyle}
              />
            </div>

            <button
              id="btn-import-contract"
              type="button"
              onClick={handleImportContract}
              disabled={importingContract || !contractUrl.trim()}
              style={{
                ...btnBase,
                background:
                  importingContract || !contractUrl.trim()
                    ? "rgba(30,41,59,0.35)"
                    : "rgba(56,189,248,0.12)",
                border: `1px solid ${
                  importingContract || !contractUrl.trim()
                    ? colors.border
                    : colors.borderActive
                }`,
                color:
                  importingContract || !contractUrl.trim() ? colors.muted : colors.accent,
                fontSize: 13,
                cursor: importingContract || !contractUrl.trim() ? "not-allowed" : "pointer",
              }}
            >
              {importingContract ? "⏳ Importing ABI…" : "⬇️ Import Contract ABI"}
            </button>

            {contractImportError && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: `${colors.red}18`,
                  border: `1px solid ${colors.red}44`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: colors.red,
                }}
              >
                {contractImportError}
              </div>
            )}

            {contractImport?.ok && contractImport.contractId && contractImport.network && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.45)",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Badge color="green">ABI Imported</Badge>
                    <Badge color="accent">
                      {contractImport.network === "public" ? "Mainnet Contract" : "Testnet Contract"}
                    </Badge>
                    {contractImport.validation?.status && (
                      <Badge color="yellow">{contractImport.validation.status}</Badge>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    <div style={{ color: colors.muted }}>
                      Contract:{" "}
                      <span style={{ color: colors.text, fontFamily: "'JetBrains Mono', monospace" }}>
                        {contractImport.contractId}
                      </span>
                    </div>
                    {contractImport.wasmHash && (
                      <div style={{ color: colors.muted }}>
                        WASM:{" "}
                        <span
                          style={{ color: colors.text, fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {truncate(contractImport.wasmHash, 42)}
                        </span>
                      </div>
                    )}
                    {contractImport.validation?.repository && (
                      <a
                        href={contractImport.validation.repository}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: colors.accent, fontSize: 12, textDecoration: "none" }}
                      >
                        View verified source ↗
                      </a>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(contractImport.functions ?? []).map((fn) => (
                    <div
                      key={fn.name}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        background: "rgba(15,23,42,0.45)",
                        padding: "12px 14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              color: "#f8fafc",
                              fontWeight: 700,
                              fontSize: 14,
                              marginBottom: 4,
                              fontFamily: "'JetBrains Mono', monospace",
                              wordBreak: "break-word",
                            }}
                          >
                            {fn.name}(
                            {fn.parameters
                              .map((param) => `${param.name}: ${param.type}`)
                              .join(", ")}
                            )
                            {fn.outputs.length > 0 ? ` -> ${fn.outputs.join(", ")}` : ""}
                          </div>
                          {fn.doc && (
                            <div
                              style={{
                                color: colors.muted,
                                fontSize: 12,
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {fn.doc}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUseSampleXdr(fn, contractImport.network!)}
                          style={{
                            ...btnBase,
                            padding: "8px 12px",
                            background: "rgba(52,211,153,0.14)",
                            border: `1px solid ${colors.green}55`,
                            color: colors.green,
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          ⚙️ Generate Sample XDR
                        </button>
                      </div>

                      {fn.parameters.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {fn.parameters.map((param) => (
                            <div key={`${fn.name}-${param.name}`} style={{ fontSize: 12 }}>
                              <span style={{ color: colors.text, fontWeight: 600 }}>
                                {param.name}
                              </span>
                              <span
                                style={{
                                  color: colors.accent,
                                  marginLeft: 6,
                                  fontFamily: "'JetBrains Mono', monospace",
                                }}
                              >
                                {param.type}
                              </span>
                              {param.doc && (
                                <span style={{ color: colors.muted, marginLeft: 8 }}>
                                  {param.doc}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Inner XDR Input */}
          <Panel>
            <SectionHeader>
              <span>📄</span> Inner Transaction XDR
            </SectionHeader>

            <div style={{ marginBottom: 10 }}>
              <textarea
                id="xdr-input"
                value={xdr}
                onChange={(e) => {
                  setXdr(e.target.value);
                  setDecoded(null);
                  setDecodeError(null);
                  setResult(null);
                }}
                placeholder="Paste base64-encoded transaction XDR here…"
                rows={5}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                id="btn-build-example"
                type="button"
                onClick={handleBuildExample}
                style={{
                  ...btnBase,
                  background: "rgba(56,189,248,0.12)",
                  border: `1px solid ${colors.borderActive}`,
                  color: colors.accent,
                  fontSize: 13,
                }}
              >
                ✨ Build Example
              </button>
              <button
                id="btn-decode-preview"
                type="button"
                onClick={handleDecode}
                disabled={!xdr.trim()}
                style={{
                  ...btnBase,
                  background: xdr.trim()
                    ? "rgba(52,211,153,0.12)"
                    : "rgba(30,41,59,0.3)",
                  border: `1px solid ${xdr.trim() ? colors.green + "66" : colors.border}`,
                  color: xdr.trim() ? colors.green : colors.muted,
                  fontSize: 13,
                  cursor: xdr.trim() ? "pointer" : "not-allowed",
                }}
              >
                🔍 Preview Decoded
              </button>
            </div>

            {decodeError && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: `${colors.red}18`,
                  border: `1px solid ${colors.red}44`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: colors.red,
                }}
              >
                {decodeError}
              </div>
            )}
          </Panel>

          {/* Decoded Preview */}
          {decoded && (
            <Panel>
              <SectionHeader>
                <span>🔬</span> Decoded XDR Preview
              </SectionHeader>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {[
                  ["Source Account", truncate(decoded.sourceAccount, 40)],
                  ["Hash", truncate(decoded.hash, 40)],
                  ["Sequence #", decoded.sequenceNumber],
                  ["Fee", `${decoded.fee} stroops`],
                  ["Signatures", String(decoded.signatures)],
                  ["Memo", decoded.memo],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", gap: 8, fontSize: 13 }}>
                    <span style={{ color: colors.muted, minWidth: 130 }}>{label}:</span>
                    <span
                      style={{
                        color: colors.text,
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        wordBreak: "break-all",
                      }}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 700, color: colors.muted }}>
                OPERATIONS ({decoded.operations.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {decoded.operations.map((op, i) => (
                  <OperationCard key={i} op={op} index={i} />
                ))}
              </div>
            </Panel>
          )}

          {/* API Key + Options */}
          <Panel>
            <SectionHeader>
              <span>🔑</span> API Key &amp; Options
            </SectionHeader>

            <div style={{ marginBottom: 10 }}>
              <label
                htmlFor="api-key-input"
                style={{ fontSize: 12, color: colors.muted, display: "block", marginBottom: 4 }}
              >
                Sandbox API Key (pre-filled — replace with your own)
              </label>
              <input
                id="api-key-input"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sbx_..."
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                id="submit-checkbox"
                type="checkbox"
                checked={submitTx}
                onChange={(e) => setSubmitTx(e.target.checked)}
                style={{ accentColor: colors.accent as string, width: 16, height: 16 }}
              />
              <label
                htmlFor="submit-checkbox"
                style={{ fontSize: 13, color: colors.text, cursor: "pointer" }}
              >
                Submit transaction to{" "}
                <span style={{ color: colors.accent }}>{network}</span> Horizon
              </label>
            </div>
          </Panel>

          {/* Fire button */}
          <button
            id="btn-fire-request"
            type="button"
            onClick={handleFire}
            disabled={loading || !xdr.trim()}
            style={{
              ...btnBase,
              width: "100%",
              padding: "14px",
              fontSize: 16,
              background:
                loading || !xdr.trim()
                  ? "rgba(30,41,59,0.4)"
                  : `linear-gradient(120deg, ${colors.accentDark} 0%, #0e7490 50%, ${colors.accent} 100%)`,
              color:
                loading || !xdr.trim() ? colors.muted : "#fff",
              boxShadow:
                !loading && xdr.trim()
                  ? `0 8px 24px ${colors.accent}33, 0 2px 6px rgba(0,0,0,0.3)`
                  : "none",
              cursor: loading || !xdr.trim() ? "not-allowed" : "pointer",
              transform: "translateZ(0)",
              letterSpacing: "0.03em",
            }}
          >
            {loading ? "⏳ Firing Request…" : "🚀 Fire Request"}
          </button>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT COLUMN – Request / Response                                 */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Placeholder when idle */}
          {!result && !loading && (
            <Panel
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 300,
                gap: 16,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 48 }}>🛸</div>
              <div style={{ color: colors.muted, fontSize: 14, lineHeight: 1.7, maxWidth: 280 }}>
                Build or paste an XDR, preview the decoded operations, then hit{" "}
                <strong style={{ color: colors.accent }}>Fire Request</strong> to see the full
                request & response JSON.
              </div>
            </Panel>
          )}

          {loading && (
            <Panel
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 200,
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  border: `3px solid ${colors.border}`,
                  borderTop: `3px solid ${colors.accent}`,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ color: colors.muted }}>Sending request…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </Panel>
          )}

          {result && (
            <>
              {/* Status badge */}
              <Panel
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: result.ok ? colors.green : colors.red,
                    boxShadow: `0 0 12px ${result.ok ? colors.green : colors.red}`,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {result.ok ? "Success" : "Error"}
                    {result.submitted != null && (
                      <span style={{ marginLeft: 8 }}>
                        <Badge color={result.submitted ? "green" : "yellow"}>
                          {result.submitted ? "Submitted to Testnet" : "XDR Ready (not submitted)"}
                        </Badge>
                      </span>
                    )}
                  </div>
                  {result.feeBumpHash && (
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: "monospace" }}>
                      Hash: {result.feeBumpHash}
                    </div>
                  )}
                  {result.feePayer && (
                    <div style={{ fontSize: 12, color: colors.muted, fontFamily: "monospace" }}>
                      Fee Payer: {truncate(result.feePayer, 36)}
                    </div>
                  )}
                </div>
              </Panel>

              {/* Request envelope */}
              {result.request && (
                <Panel>
                  <SectionHeader>
                    <span>📤</span> Request Sent
                  </SectionHeader>
                  <CodeBlock
                    value={JSON.stringify(result.request, null, 2)}
                    label="request"
                  />
                </Panel>
              )}

              {/* Response envelope */}
              {result.response && (
                <Panel>
                  <SectionHeader>
                    <span>📥</span> Response
                  </SectionHeader>
                  <CodeBlock
                    value={JSON.stringify(result.response, null, 2)}
                    label="response"
                  />
                </Panel>
              )}

              {/* Raw full response */}
              <Panel>
                <SectionHeader>
                  <span>🗒️</span> Full API Response JSON
                </SectionHeader>
                <CodeBlock
                  value={JSON.stringify(result, null, 2)}
                  label="full response"
                  maxHeight={480}
                />
              </Panel>

              {/* Fee-bump XDR */}
              {result.feeBumpXdr && (
                <Panel>
                  <SectionHeader>
                    <span>📦</span> Fee-Bumped XDR
                  </SectionHeader>
                  <CodeBlock value={result.feeBumpXdr} label="fee bump xdr" maxHeight={120} />
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

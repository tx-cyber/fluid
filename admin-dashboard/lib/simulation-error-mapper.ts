/**
 * simulation-error-mapper.ts
 *
 * Translates cryptic Horizon / Soroban simulation error codes into
 * human-readable messages while preserving the original trace for
 * advanced consumers.
 *
 * Issue #128 – Pre-flight Simulation Error Mapping for UI
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The severity level of a mapped error. */
export type ErrorSeverity = "critical" | "warning" | "info";

/** The broad category of the error. */
export type ErrorCategory =
    | "insufficient_funds"
    | "auth"
    | "contract_revert"
    | "resource"
    | "network"
    | "rate_limit"
    | "validation"
    | "unknown";

/**
 * A structured, developer-friendly error object.
 *
 * `title`        – Short, human-readable label (shown prominently in UI).
 * `message`      – Full explanation of what went wrong.
 * `hint`         – Optional actionable suggestion.
 * `category`     – Machine-readable category for programmatic handling.
 * `severity`     – How bad is it? critical / warning / info.
 * `code`         – The raw error code string as-received from the network.
 * `originalTrace`– The complete, unmodified payload from the simulation.
 */
export interface MappedSimulationError {
    title: string;
    message: string;
    hint?: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    code: string;
    originalTrace: unknown;
}

// ---------------------------------------------------------------------------
// Internal dictionary
// ---------------------------------------------------------------------------

interface ErrorEntry {
    title: string;
    message: string;
    hint?: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
}

/**
 * Known Stellar / Soroban error codes → friendly descriptions.
 *
 * Sources:
 *   - Stellar XDR TransactionResultCode
 *   - Soroban host function error codes
 *   - Horizon HTTP 400 extras.result_codes
 */
const ERROR_DICTIONARY: Record<string, ErrorEntry> = {
    // ── Transaction-level codes ────────────────────────────────────────────────
    tx_insufficient_balance: {
        title: "Insufficient Funds",
        message:
            "The source account does not have enough XLM to cover the transaction fee and minimum reserve.",
        hint: "Top up the account with at least 1 XLM and retry.",
        category: "insufficient_funds",
        severity: "critical",
    },
    tx_insufficient_fee: {
        title: "Fee Too Low",
        message:
            "The fee attached to this transaction was rejected by the network — it is lower than the current base fee.",
        hint: "Increase the fee or use fee-bump to let the sponsor cover it.",
        category: "insufficient_funds",
        severity: "warning",
    },
    tx_bad_auth: {
        title: "Authorization Failed",
        message: "One or more required signatures are missing or invalid.",
        hint: "Ensure all signers have signed the transaction envelope correctly.",
        category: "auth",
        severity: "critical",
    },
    tx_bad_auth_extra: {
        title: "Extra Signatures Detected",
        message:
            "The transaction carries more signatures than declared by the account thresholds.",
        hint: "Remove superfluous signatures from the envelope.",
        category: "auth",
        severity: "warning",
    },
    tx_no_account: {
        title: "Account Not Found",
        message:
            "The source account does not exist on the current network (Mainnet / Testnet).",
        hint: "Fund the account with at least the minimum reserve via Friendbot (Testnet) or a faucet.",
        category: "validation",
        severity: "critical",
    },
    tx_bad_seq: {
        title: "Sequence Number Mismatch",
        message:
            "The transaction sequence number is out of sync with the on-chain account sequence.",
        hint: "Fetch the latest sequence number and rebuild the transaction.",
        category: "validation",
        severity: "warning",
    },
    tx_too_early: {
        title: "Transaction Too Early",
        message: "The transaction's minTime has not been reached yet.",
        hint: "Wait until the specified time-bounds window opens.",
        category: "validation",
        severity: "info",
    },
    tx_too_late: {
        title: "Transaction Expired",
        message:
            "The transaction's maxTime has passed — it is no longer valid on the network.",
        hint: "Rebuild the transaction with an updated time-bounds window.",
        category: "validation",
        severity: "warning",
    },
    tx_missing_operation: {
        title: "No Operations",
        message: "The transaction envelope contains zero operations.",
        hint: "Add at least one Stellar operation before submitting.",
        category: "validation",
        severity: "critical",
    },
    tx_internal_error: {
        title: "Network Internal Error",
        message: "The Stellar network encountered an unexpected internal error.",
        hint: "Retry the transaction. If the issue persists, check the Stellar status page.",
        category: "network",
        severity: "critical",
    },
    tx_not_supported: {
        title: "Operation Not Supported",
        message:
            "One or more operations are not supported by the current protocol version.",
        hint: "Upgrade your SDK version and confirm the network protocol level.",
        category: "validation",
        severity: "critical",
    },

    // ── Operation-level codes ─────────────────────────────────────────────────
    op_underfunded: {
        title: "Insufficient Funds for Operation",
        message:
            "The source account cannot fund the requested operation (payment, trust, etc.).",
        hint: "Check the account balance and liabilities before retrying.",
        category: "insufficient_funds",
        severity: "critical",
    },
    op_no_trust: {
        title: "Missing Trustline",
        message:
            "The destination or source account has no trustline for the specified asset.",
        hint: "Establish a trustline with an appropriate limit before sending.",
        category: "validation",
        severity: "warning",
    },
    op_no_destination: {
        title: "Destination Not Found",
        message: "The destination account does not exist on the network.",
        hint: "Create the destination account first or use createAccount operation.",
        category: "validation",
        severity: "critical",
    },
    op_low_reserve: {
        title: "Low Reserve",
        message:
            "The transaction would bring the account below the required minimum XLM reserve.",
        hint: "Ensure the account retains at least (2 + num_subentries) × base_reserve XLM.",
        category: "insufficient_funds",
        severity: "warning",
    },
    op_line_full: {
        title: "Trustline Limit Reached",
        message:
            "Adding this balance would exceed the destination account's trustline limit.",
        hint: "Ask the recipient to increase their trustline limit.",
        category: "validation",
        severity: "warning",
    },

    // ── Soroban / smart-contract codes ────────────────────────────────────────
    "HostError:Value(InvalidInput)": {
        title: "Contract Revert: Invalid Input",
        message:
            "The smart contract rejected an argument — the value passed is of an unexpected type or outside the accepted range.",
        hint: "Review the contract ABI for correct argument types.",
        category: "contract_revert",
        severity: "critical",
    },
    "HostError:Value(MissingValue)": {
        title: "Contract Revert: Missing Value",
        message:
            "The contract attempted to read a storage key that does not exist.",
        hint: "Ensure all prerequisite storage entries are initialised before this call.",
        category: "contract_revert",
        severity: "critical",
    },
    "HostError:Auth(NotAuthorized)": {
        title: "Contract Revert: Not Authorised",
        message:
            "The contract's authorization check failed — the caller lacks permission for this action.",
        hint: "Attach the required auth entries or invoke via the authorised caller address.",
        category: "auth",
        severity: "critical",
    },
    "HostError:WasmVm(InvalidAction)": {
        title: "Contract Revert: Invalid Action",
        message:
            "The WASM contract attempted an illegal VM action (e.g., out-of-bounds memory access, integer overflow).",
        hint: "This is likely a contract bug. Check the contract source for overflow guards.",
        category: "contract_revert",
        severity: "critical",
    },
    "HostError:Budget(CpuLimitExceeded)": {
        title: "Resource Limit: CPU Exceeded",
        message:
            "The contract consumed more CPU instructions than the Soroban ledger budget allows.",
        hint: "Optimise the contract or split the operation into smaller batches.",
        category: "resource",
        severity: "critical",
    },
    "HostError:Budget(MemLimitExceeded)": {
        title: "Resource Limit: Memory Exceeded",
        message:
            "The contract exceeded the Soroban memory budget for this transaction.",
        hint: "Reduce data structures or split work across multiple transactions.",
        category: "resource",
        severity: "critical",
    },
    simulation_failed: {
        title: "Simulation Failed",
        message:
            "The pre-flight simulation could not be completed — the server returned no result.",
        hint: "Check the RPC endpoint health and retry.",
        category: "network",
        severity: "critical",
    },
    rate_limit_exceeded: {
        title: "Rate Limit Exceeded",
        message: "Too many requests have been sent to the RPC in a short window.",
        hint: "Implement exponential back-off and retry after a few seconds.",
        category: "rate_limit",
        severity: "warning",
    },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a raw Horizon / Soroban simulation result and returns a structured
 * {@link MappedSimulationError}.
 *
 * Accepts plain strings, objects with `result_codes`, objects with a
 * Soroban `error` field, or arbitrary unknown shapes.
 *
 * The `originalTrace` field always contains the unmodified input so callers
 * can log or display the full technical detail when needed.
 *
 * @param raw – The raw error payload from the network or SDK.
 * @returns   A fully structured {@link MappedSimulationError}.
 */
export function parseSimulationError(raw: unknown): MappedSimulationError {
    const code = extractCode(raw);
    const entry = lookupEntry(code);

    return {
        ...entry,
        code,
        originalTrace: raw,
    };
}

/**
 * Returns `true` when the provided value looks like a failed simulation result
 * that should be passed to {@link parseSimulationError}.
 */
export function isSimulationError(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        return (
            "error" in obj ||
            "result_codes" in obj ||
            "extras" in obj ||
            "status" in obj
        );
    }
    return false;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extracts the most specific error-code string from the raw payload. */
function extractCode(raw: unknown): string {
    if (raw == null) return "unknown";

    if (typeof raw === "string") {
        const trimmed = raw.trim();
        // Direct dictionary match first
        if (trimmed in ERROR_DICTIONARY) return trimmed;
        // Soroban HostError prefix
        if (trimmed.startsWith("HostError:")) return trimmed;
        return trimmed || "unknown";
    }

    if (typeof raw === "object") {
        const obj = raw as Record<string, unknown>;

        // Soroban RPC: { error: "HostError:..." }
        if (typeof obj.error === "string") {
            const err = obj.error.trim();
            if (err in ERROR_DICTIONARY) return err;
            if (err.startsWith("HostError:")) return err;
            return err;
        }

        // Horizon: { extras: { result_codes: { transaction: "...", operations: [...] } } }
        const extras = obj.extras as Record<string, unknown> | undefined;
        const resultCodes = (extras?.result_codes ?? obj.result_codes) as
            | Record<string, unknown>
            | undefined;

        if (resultCodes) {
            // Prefer operation-level code (more specific)
            if (Array.isArray(resultCodes.operations)) {
                const opCode = (resultCodes.operations as string[]).find(
                    (c) => c !== "op_success" && c !== "op_inner"
                );
                if (opCode) return opCode;
            }
            if (typeof resultCodes.transaction === "string") {
                return resultCodes.transaction;
            }
        }

        // Soroban simulate: { status: "ERROR", error: "..." }
        if (typeof obj.status === "string" && obj.status === "ERROR") {
            return "simulation_failed";
        }
    }

    return "unknown";
}

/** Looks up a known entry or falls back to a generic unknown mapping. */
function lookupEntry(code: string): ErrorEntry {
    // Exact match
    if (code in ERROR_DICTIONARY) return ERROR_DICTIONARY[code];

    // Prefix match for HostError subcategories
    for (const key of Object.keys(ERROR_DICTIONARY)) {
        if (code.startsWith(key) || key.startsWith(code)) {
            return ERROR_DICTIONARY[key];
        }
    }

    // Pattern-based fallbacks
    if (code.includes("insufficient") || code.includes("underfunded")) {
        return ERROR_DICTIONARY["tx_insufficient_balance"];
    }
    if (code.includes("auth") || code.includes("Auth")) {
        return ERROR_DICTIONARY["tx_bad_auth"];
    }
    if (code.includes("revert") || code.includes("HostError")) {
        return {
            title: "Contract Revert",
            message: `The smart contract reverted with code: ${code}`,
            hint: "Inspect the original trace below for details.",
            category: "contract_revert",
            severity: "critical",
        };
    }

    return {
        title: "Unknown Simulation Error",
        message: `An unrecognised simulation error was returned by the network.`,
        hint: "Expand the technical details below and consult the Stellar developer docs.",
        category: "unknown",
        severity: "critical",
    };
}

// ---------------------------------------------------------------------------
// Convenience re-export of the full dictionary (read-only)
// ---------------------------------------------------------------------------
export const KNOWN_ERROR_CODES = Object.keys(ERROR_DICTIONARY) as ReadonlyArray<string>;

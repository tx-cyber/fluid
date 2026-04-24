import { Request, Response } from "express";
import {
  listGranters,
  getGranter,
  createGranter,
  updateGranter,
  deleteGranter,
  grantAllowance,
  revokeAllowance,
  listAllowances,
  queryOnChainAllowances,
} from "../services/cosmosFeeGrant";
import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "adminCosmosFeeGrant" });

// ---------------------------------------------------------------------------
// Granter config CRUD
// ---------------------------------------------------------------------------

export async function listGrantersHandler(req: Request, res: Response) {
  const granters = await listGranters();
  res.json({ granters });
}

export async function getGranterHandler(req: Request, res: Response) {
  const granter = await getGranter(req.params.id);
  if (!granter) return res.status(404).json({ error: "Granter not found" });
  res.json(granter);
}

export async function createGranterHandler(req: Request, res: Response) {
  const { chainId, name, rpcUrl, prefix, denom, mnemonic } = req.body;
  if (!chainId || !name || !rpcUrl) {
    return res.status(400).json({ error: "chainId, name, and rpcUrl are required" });
  }
  try {
    const granter = await createGranter({ chainId, name, rpcUrl, prefix, denom, mnemonic });
    res.status(201).json(granter);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to create granter");
    res.status(409).json({ error: error.message });
  }
}

export async function updateGranterHandler(req: Request, res: Response) {
  try {
    const granter = await updateGranter(req.params.id, req.body);
    res.json(granter);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to update granter");
    res.status(404).json({ error: error.message });
  }
}

export async function deleteGranterHandler(req: Request, res: Response) {
  try {
    await deleteGranter(req.params.id);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Fee grant operations
// ---------------------------------------------------------------------------

export async function grantAllowanceHandler(req: Request, res: Response) {
  const { granteeAddr, allowanceType, spendLimit, expirationSeconds, periodSeconds, periodLimit } = req.body;
  if (!granteeAddr || !allowanceType) {
    return res.status(400).json({ error: "granteeAddr and allowanceType are required" });
  }
  if (!["basic", "periodic"].includes(allowanceType)) {
    return res.status(400).json({ error: "allowanceType must be 'basic' or 'periodic'" });
  }
  if (allowanceType === "periodic" && (!periodSeconds || !periodLimit)) {
    return res.status(400).json({ error: "periodic allowance requires periodSeconds and periodLimit" });
  }

  try {
    const record = await grantAllowance(req.params.id, {
      granteeAddr,
      allowanceType,
      spendLimit,
      expirationSeconds,
      periodSeconds,
      periodLimit,
    });
    res.status(201).json(record);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to grant allowance");
    res.status(400).json({ error: error.message });
  }
}

export async function revokeAllowanceHandler(req: Request, res: Response) {
  const { granteeAddr } = req.body;
  if (!granteeAddr) {
    return res.status(400).json({ error: "granteeAddr is required" });
  }

  try {
    const record = await revokeAllowance(req.params.id, granteeAddr);
    res.json(record);
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to revoke allowance");
    res.status(400).json({ error: error.message });
  }
}

export async function listAllowancesHandler(req: Request, res: Response) {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const allowances = await listAllowances(req.params.id, status);
  res.json({ allowances });
}

export async function queryOnChainHandler(req: Request, res: Response) {
  try {
    const allowances = await queryOnChainAllowances(req.params.id);
    res.json({ allowances });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to query on-chain allowances");
    res.status(400).json({ error: error.message });
  }
}

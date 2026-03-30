import { z } from "zod";

export const FeeBumpSchema = z
  .object({
    chainId: z.enum(["stellar", "evm", "solana"]).default("stellar"),
    xdr: z.string().optional(), // Stellar
    userOp: z.any().optional(), // EVM
    transactionB64: z.string().optional(), // Solana
    submit: z.boolean().optional(),
    token: z.string().optional(),
    maxSlippage: z.number().min(0).max(100).optional(),
  })
  .strict();

export type FeeBumpRequest = z.infer<typeof FeeBumpSchema>;

export const FeeBumpBatchSchema = z.object({
  xdrs: z.array(z.string().min(1)).min(1, "xdrs field is required and must contain at least one string"),
  submit: z.boolean().optional(),
  token: z.string().optional(),
}).strict();

export type FeeBumpBatchRequest = z.infer<typeof FeeBumpBatchSchema>;

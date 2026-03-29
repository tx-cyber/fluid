## Title
feat: add cross-chain EVM settlement for Stellar fee sponsorship

## Description

This PR adds a Phase 11 multi-chain settlement path so enterprise tenants can pay sponsorship fees in an EVM ERC-20 token, then have Fluid release the Stellar fee-bump after the payment confirms on-chain.

### What changed

1. Added `evmSettlement` request support on `/fee-bump` and return an `awaiting_evm_payment` response with the required payment details.
2. Introduced a durable `CrossChainSettlement` model and migration to track queued payments, confirmations, settlement success, and refund outcomes.
3. Added an EVM settlement service that:
   - polls ERC-20 `Transfer` logs for the expected payer, token, recipient, and amount
   - promotes confirmed payments into Stellar fee-bump execution
   - sends an ERC-20 refund if Stellar settlement fails after EVM confirmation
4. Documented the new EVM environment variables in `.env.example`.
5. Extended Swagger docs for the new request and response shape.

### Atomicity model

Fluid now uses an application-level atomic settlement protocol:

- queue the Stellar bump first
- wait for the EVM payment confirmation
- release the Stellar fee-bump
- if Stellar submission fails, issue an ERC-20 refund from the configured refund sender

### Verification

- Added tests for queued EVM settlement responses
- Added tests for confirmed payment -> Stellar settlement
- Added tests for Stellar failure -> EVM refund
- Re-ran related fee-bump tests successfully

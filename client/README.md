# Fluid Client

TypeScript client library for interacting with Fluid servers.

## Installation

```bash
npm install
```

## Usage

```typescript
import { FluidClient } from "fluid-client";
import StellarSdk from "@stellar/stellar-sdk";

const client = new FluidClient({
  serverUrl: "http://localhost:3000",
  networkPassphrase: StellarSdk.Networks.TESTNET,
  horizonUrl: "https://horizon-testnet.stellar.org",
});

const transaction = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(/* your operation */)
  .build();

transaction.sign(keypair);

const result = await client.requestFeeBump(transaction, false);
const submitResult = await client.submitFeeBumpTransaction(result.xdr);
```

## React Hook

`useFeeBump` wraps the `FluidClient` fee-bump request flow in React state so components get `isLoading`, `error`, and `result` without managing raw `fetch` calls.

```tsx
import { useMemo, useState } from "react";
import StellarSdk from "@stellar/stellar-sdk";
import { FluidClient, useFeeBump } from "fluid-client";

interface SponsorButtonProps {
  transaction: StellarSdk.Transaction;
}

export function SponsorButton({ transaction }: SponsorButtonProps) {
  const [submit, setSubmit] = useState(false);

  const client = useMemo(
    () =>
      new FluidClient({
        serverUrl: process.env.NEXT_PUBLIC_FLUID_SERVER_URL ?? "http://localhost:3000",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      }),
    []
  );

  const { requestFeeBump, isLoading, error, result } = useFeeBump(client);

  async function handleSponsorClick() {
    await requestFeeBump(transaction, submit);
  }

  return (
    <div>
      <label>
        <input
          checked={submit}
          disabled={isLoading}
          onChange={(event) => setSubmit(event.target.checked)}
          type="checkbox"
        />
        Submit immediately
      </label>

      <button disabled={isLoading} onClick={handleSponsorClick} type="button">
        {isLoading ? "Sponsoring..." : "Sponsor transaction"}
      </button>

      {error ? <p role="alert">{error.message}</p> : null}
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}
```

## API

### `FluidClient`

#### Constructor

```typescript
new FluidClient(config: {
  serverUrl: string;
  networkPassphrase: string;
  horizonUrl?: string;
})
```

#### Methods

- `requestFeeBump(transactionOrXdr: string | { toXDR(): string }, submit?: boolean)` - Request a fee-bump using either signed XDR or a transaction object
- `submitFeeBumpTransaction(feeBumpXdr: string)` - Submit a fee-bump transaction to Horizon
- `buildAndRequestFeeBump(transaction: Transaction, submit?: boolean)` - Build, sign, and request fee-bump

### `useFeeBump`

```typescript
const { requestFeeBump, isLoading, error, result } = useFeeBump(client);
```

- `requestFeeBump(transactionOrXdr, submit?)` accepts either a signed XDR string or an object with `toXDR()`
- `isLoading` is `true` while the request is in flight
- `error` contains the last thrown error, if any
- `result` contains the latest successful fee-bump response

## Development

```bash
npm run build
```

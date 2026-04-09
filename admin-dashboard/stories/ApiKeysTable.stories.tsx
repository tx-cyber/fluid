import type { Meta, StoryObj } from "@storybook/react";
import { ApiKeysTable } from "@/components/dashboard/ApiKeysTable";
import type { ApiKey } from "@/components/dashboard/types";

function makeKey(id: string, overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id,
    key: `test_pk_${id.replace(/-/g, "").slice(0, 16)}`,
    prefix: "test_pk_",
    tenantId: "acme-corp",
    active: true,
    allowedChains: ["stellar"],
    createdAt: new Date("2026-03-25T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-25T10:00:00Z").toISOString(),
    ...overrides,
  };
}

const allChainsKey = makeKey("1", {
  allowedChains: ["stellar", "evm", "solana", "cosmos"],
});

const singleChainKey = makeKey("2", {
  allowedChains: ["stellar"],
});

const revokedKey = makeKey("3", {
  active: false,
});

const meta: Meta<typeof ApiKeysTable> = {
  title: "Dashboard/ApiKeysTable",
  component: ApiKeysTable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Displays a table of API keys for a tenant. Allows revoking keys and toggling per-chain permissions inline. State changes mock API calls to fluidServerUrl.",
      },
    },
  },
  args: {
    serverUrl: "http://localhost:3000",
    adminToken: "mock-token",
  },
};

export default meta;
type Story = StoryObj<typeof ApiKeysTable>;

export const Populated: Story = {
  name: "Multiple Keys",
  args: {
    initialKeys: [allChainsKey, singleChainKey, revokedKey],
  },
};

export const SingleRowActive: Story = {
  name: "Single Active Key",
  args: {
    initialKeys: [singleChainKey],
  },
};

export const SingleRowRevoked: Story = {
  name: "Single Revoked Key",
  args: {
    initialKeys: [revokedKey],
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    initialKeys: [],
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { TransactionTable } from "@/components/dashboard/TransactionTable";
import type {
  TransactionHistoryPageData,
  TransactionHistoryRow,
} from "@/components/dashboard/types";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<TransactionHistoryRow> = {}, idFallback = "1"): TransactionHistoryRow {
  return {
    id: `tx-${idFallback}`,
    innerHash: "abc123def456789012345678901234567890abcdef01234567",
    timestamp: new Date("2026-03-28T14:32:00Z").toISOString(),
    status: "success",
    category: "fee_bump",
    costStroops: 1200,
    tenant: "acme-corp",
    ...overrides,
  };
}

const sampleRows: TransactionHistoryRow[] = [
  makeRow({ innerHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, "1"),
  makeRow({
    innerHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    status: "pending",
    tenant: "globex",
    costStroops: 500,
  }, "2"),
  makeRow({
    innerHash: "cccccccccccccccccccccccccccccccccccccccccccccccc",
    status: "failed",
    category: "sponsorship",
    tenant: "initech",
    costStroops: 3800,
  }, "3"),
  makeRow({
    innerHash: "dddddddddddddddddddddddddddddddddddddddddddddddd",
    tenant: "umbrella",
    costStroops: 900,
  }, "4"),
  makeRow({
    innerHash: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    status: "success",
    tenant: "cyberdyne",
    costStroops: 2100,
  }, "5"),
];

const baseData: TransactionHistoryPageData = {
  rows: sampleRows,
  page: 1,
  pageSize: 10,
  totalPages: 3,
  totalRows: 28,
  search: "",
  sort: "time_desc",
  source: "sample"
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const meta: Meta<typeof TransactionTable> = {
  title: "Dashboard/TransactionTable",
  component: TransactionTable,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Server-rendered transaction history table with sort links, search form, export dropdown, and previous/next pagination. Displays fee-bump activity with per-row copy buttons.",
      },
    },
  },
  args: {
    basePath: "/admin/transactions",
  },
};

export default meta;
type Story = StoryObj<typeof TransactionTable>;

export const Populated: Story = {
  name: "Populated – page 1 of 3",
  args: {
    data: baseData,
  },
};

export const SecondPage: Story = {
  name: "Second Page – Previous enabled",
  args: {
    data: { ...baseData, page: 2 },
  },
};

export const LastPage: Story = {
  name: "Last Page – Next disabled",
  args: {
    data: { ...baseData, page: 3 },
  },
};

export const WithSearch: Story = {
  name: "With Active Search Filter",
  args: {
    data: { ...baseData, search: "acme", rows: sampleRows.slice(0, 1), totalRows: 1, totalPages: 1 },
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    data: { ...baseData, rows: [], totalRows: 0, totalPages: 0 },
  },
};

export const SortedByCostAsc: Story = {
  name: "Sorted by Cost Ascending",
  args: {
    data: {
      ...baseData,
      sort: "cost_asc",
      rows: [...sampleRows].sort((a, b) => a.costStroops - b.costStroops),
    },
  },
};

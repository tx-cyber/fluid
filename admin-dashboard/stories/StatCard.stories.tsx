import type { Meta, StoryObj } from "@storybook/react";
import { Coins, CheckCircle, Wallet, Zap, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";

const meta: Meta<typeof StatCard> = {
  title: "Dashboard/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A KPI card that shows a title, metric value, optional trend delta, and an icon. Used across the admin dashboard to surface key operational numbers.",
      },
    },
  },
  argTypes: {
    icon: { control: false },
    title: { control: "text" },
    value: { control: "text" },
    delta: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const TotalSponsored: Story = {
  name: "Total XLM Sponsored",
  args: {
    title: "Total XLM Sponsored",
    value: "1,250,000",
    delta: "+5% from last week",
    icon: Coins,
  },
};

export const SuccessfulTransactions: Story = {
  name: "Successful Transactions",
  args: {
    title: "Successful Transactions",
    value: "45,678",
    delta: "+12% from last week",
    icon: CheckCircle,
  },
};

export const AvailableBalance: Story = {
  name: "Available Balance",
  args: {
    title: "Available Balance",
    value: "9,842.50 XLM",
    delta: "~28 days runway",
    icon: Wallet,
  },
};

export const FeeMultiplier: Story = {
  name: "Dynamic Fee Multiplier",
  args: {
    title: "Dynamic Fee Multiplier",
    value: "1.3x",
    delta: "low congestion",
    icon: Zap,
  },
};

export const WithoutDelta: Story = {
  name: "No Delta / Trend",
  args: {
    title: "Monthly Revenue",
    value: "$4,200",
    icon: TrendingUp,
  },
};

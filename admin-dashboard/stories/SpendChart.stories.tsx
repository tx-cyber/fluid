import type { Meta, StoryObj } from "@storybook/react";
import { SpendChart } from "@/components/dashboard/SpendChart";
import type { SpendForecastData } from "@/components/dashboard/types";

// ---------------------------------------------------------------------------
// Fixture data helpers
// ---------------------------------------------------------------------------

function makeDayPoints(
  count: number,
  startBalance: number,
  dailyDelta: number,
): { date: string; balanceXlm: number }[] {
  const points: { date: string; balanceXlm: number }[] = [];
  const base = new Date("2026-02-01");

  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    points.push({
      date: d.toISOString().slice(0, 10),
      balanceXlm: Math.max(0, startBalance + i * dailyDelta),
    });
  }
  return points;
}

const healthyForecast: SpendForecastData = {
  historicalBalance: makeDayPoints(30, 10_000, -80),
  projectedBalance: makeDayPoints(14, 7_600, -80).map((p, i) => ({
    ...p,
    date: new Date(new Date("2026-03-03").setDate(3 + i))
      .toISOString()
      .slice(0, 10),
  })),
  currentBalanceXlm: 7_600,
  runwayMessage: "~95 days runway remaining at current burn rate",
  alert: false,
  averageDailySpendXlm: 80,
  runwayDays: 95,
  source: "sample",
  spendSeries: makeDayPoints(30, 0, 80).map(p => ({ date: p.date, spendXlm: p.balanceXlm }))
};

const warningForecast: SpendForecastData = {
  historicalBalance: makeDayPoints(30, 2_000, -120),
  projectedBalance: makeDayPoints(7, 400, -120).map((p, i) => ({
    ...p,
    date: new Date(new Date("2026-03-03").setDate(3 + i))
      .toISOString()
      .slice(0, 10),
  })),
  currentBalanceXlm: 400,
  runwayMessage: "~3 days runway remaining",
  alert: true,
  averageDailySpendXlm: 120,
  runwayDays: 3,
  source: "sample",
  spendSeries: makeDayPoints(30, 0, 120).map(p => ({ date: p.date, spendXlm: p.balanceXlm }))
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const meta: Meta<typeof SpendChart> = {
  title: "Dashboard/SpendChart",
  component: SpendChart,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Balance Runway Forecast chart showing historical XLM balance and projected balance using linear regression. An alert banner appears when runway falls below 7 days.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SpendChart>;

export const HealthyRunway: Story = {
  name: "Healthy Runway (~95 days)",
  args: {
    forecast: healthyForecast,
  },
};

export const LowRunwayAlert: Story = {
  name: "Low Runway Alert (<7 days)",
  args: {
    forecast: warningForecast,
  },
};

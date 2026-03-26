export interface SpendDataPoint {
    date: string;       // e.g. "Mar 01"
    isoDate: string;    // e.g. "2026-03-01" — used for tooltip formatting
    xlmSpent: number;   // raw XLM amount
  }
  
  /**
   * Generates 30 days of mock daily XLM spend ending today.
   * Replace this with a real API call when the backend is ready.
   */
  export function getDailySpendData(): SpendDataPoint[] {
    const data: SpendDataPoint[] = [];
    const today = new Date();
  
    // Seeded spend pattern — realistic treasury usage with a mid-month spike
    const baseSpend = [
      420, 380, 510, 470, 390, 620, 580, 445, 490, 530,
      710, 680, 920, 870, 1050, 990, 760, 640, 580, 500,
      430, 610, 570, 490, 520, 480, 610, 590, 540, 470,
    ];
  
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
  
      const isoDate = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  
      data.push({
        date: label,
        isoDate,
        xlmSpent: baseSpend[29 - i],
      });
    }
  
    return data;
  }
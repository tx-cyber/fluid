export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="mx-auto max-w-7xl py-12">
          <header className="mb-16 space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
              Fluid Dashboard
            </h1>
            <p className="max-w-2xl text-lg opacity-80 font-medium text-foreground">
              Simplify Stellar fee sponsorship with high-performance infrastructure.
              Manage wallets, track transactions, and monitor network health in real-time.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Transaction Monitoring",
                desc: "Watch fee-bump transactions as they hit the ledger with millisecond precision.",
                val: "1.2k",
                unit: "Today",
                trend: "+12.5%",
              },
              {
                title: "Active Fee Payers",
                desc: "Status of your sponsored accounts and their XLM balances across networks.",
                val: "14",
                unit: "Active",
                trend: "+2",
              },
              {
                title: "Cost Efficiency",
                desc: "Analyze your sponsorship savings and network fee trends over time.",
                val: "+22%",
                unit: "Vs Last Week",
                trend: "Optimal",
              },
            ].map((stat, i) => (
              <div
                key={stat.title}
                className="group relative h-full overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/5 p-8 shadow-sm transition-all hover:bg-foreground/[0.08]"
              >
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider opacity-60 text-foreground">
                    {stat.title}
                  </h2>
                  <p className="text-sm leading-relaxed opacity-80 text-foreground">
                    {stat.desc}
                  </p>
                </div>
                <div className="mt-8 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-foreground">
                      {stat.val}
                    </span>
                    <span className="text-sm font-medium opacity-60 text-foreground">
                      {stat.unit}
                    </span>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-500">
                    {stat.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <section className="mt-20 overflow-hidden rounded-[2.5rem] border border-foreground/10 bg-foreground/[0.03] p-12 transition-all">
            <div className="relative z-10 flex flex-col items-center justify-between gap-10 md:flex-row">
              <div className="max-w-xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                  </span>
                  New Protocol
                </div>
                <h3 className="text-3xl font-bold tracking-tight text-foreground">
                  Ready to optimize?
                </h3>
                <p className="text-lg opacity-80 text-foreground">
                  Try out the new multi-signer fee-bump protocol in the testing lab.
                  Improve security and performance for your Stellar transactions.
                </p>
              </div>
              <button className="flex items-center gap-2 rounded-full bg-foreground px-8 py-4 text-base font-bold text-background shadow-lg transition-all hover:opacity-90 active:scale-95">
                Explore Tech
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

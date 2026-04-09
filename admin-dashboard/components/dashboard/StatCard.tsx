import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
}

export function StatCard({ title, value, delta, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-border/50 glass p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{value}</p>
          {delta && (
            <p className="mt-1 text-xs font-medium text-primary">{delta}</p>
          )}
        </div>
        <div className="rounded-2xl bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
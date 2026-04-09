import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
}

export function StatCard({ title, value, delta, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {delta && (
            <p className="mt-1 text-sm text-slate-600">{delta}</p>
          )}
        </div>
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
    </div>
  );
}
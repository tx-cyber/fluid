"use client";

import { AiSupportWidget } from "@/components/dashboard/AiSupportWidget";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <AiSupportWidget />
    </SessionProvider>
  );
}

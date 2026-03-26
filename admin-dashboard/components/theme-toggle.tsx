"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Provide immediate feedback by rendering a skeleton while mounting
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100/50 dark:bg-zinc-800/50 animate-pulse" />
        );
    }

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-background transition-all hover:border-zinc-900 hover:bg-white dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-background shadow-sm"
            aria-label="Toggle theme"
        >
            <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-foreground" />
            <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100  text-foreground group-hover:text-blue-400" />
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}

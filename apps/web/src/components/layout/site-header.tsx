"use client";

import { Moon, Sun, Bell, User } from "lucide-react";
import { useTheme } from "next-themes";

export function SiteHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div>
        {/* Breadcrumb or page title can go here */}
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[0.3rem] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </button>

        {/* Notifications */}
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-[0.3rem] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </button>

        {/* User menu */}
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-[0.3rem] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <User className="h-5 w-5" />
          <span className="sr-only">User menu</span>
        </button>
      </div>
    </header>
  );
}

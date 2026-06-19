"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "~/components/ui/button";
import { copy, type Locale } from "~/lib/i18n";

export function ThemeToggle({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const text = copy[locale].common;
  const isDark = mounted && resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? text.themeLight
      : text.themeDark
    : text.themeToggle;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

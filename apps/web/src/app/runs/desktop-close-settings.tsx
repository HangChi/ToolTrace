"use client";

import * as React from "react";
import { Check, CircleHelp, Minus, Power, Settings } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { copy, type Locale } from "~/lib/i18n";
import { cn } from "~/lib/utils";

type CloseBehavior = "ask" | "exit" | "minimize";

type PreferenceResponse = {
  available?: boolean;
  closeBehavior?: unknown;
};

export function DesktopCloseSettings({ locale }: { locale: Locale }) {
  const text = copy[locale].runs;
  const [open, setOpen] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [closeBehavior, setCloseBehavior] = React.useState<CloseBehavior>("ask");

  React.useEffect(() => {
    let active = true;

    fetch("/api/desktop-preferences", { cache: "no-store" })
      .then((response) => response.json() as Promise<PreferenceResponse>)
      .then((data) => {
        if (!active) {
          return;
        }

        setAvailable(data.available === true);
        setCloseBehavior(parseCloseBehavior(data.closeBehavior));
      })
      .catch(() => {
        if (active) {
          setAvailable(false);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const options = [
    {
      value: "ask" as const,
      label: text.desktopCloseAsk,
      description: text.desktopCloseAskDetail,
      icon: CircleHelp
    },
    {
      value: "exit" as const,
      label: text.desktopCloseExit,
      description: text.desktopCloseExitDetail,
      icon: Power
    },
    {
      value: "minimize" as const,
      label: text.desktopCloseMinimize,
      description: text.desktopCloseMinimizeDetail,
      icon: Minus
    }
  ];

  async function savePreference(nextBehavior: CloseBehavior) {
    const previousBehavior = closeBehavior;

    setSaving(true);
    setError(false);
    setCloseBehavior(nextBehavior);

    try {
      const response = await fetch("/api/desktop-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closeBehavior: nextBehavior })
      });

      if (!response.ok) {
        throw new Error(`Preference save failed with ${response.status}`);
      }

      const data = (await response.json()) as PreferenceResponse;
      setAvailable(data.available === true);
      setCloseBehavior(parseCloseBehavior(data.closeBehavior));
    } catch {
      setCloseBehavior(previousBehavior);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  const statusText = error
    ? text.desktopSettingsFailed
    : saving
      ? text.desktopSettingsSaving
      : available && !loading
        ? text.desktopSettingsSaved
        : text.desktopSettingsUnavailable;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={text.desktopSettings}
          title={text.desktopSettings}
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="sr-only">{text.desktopSettings}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.desktopCloseBehavior}</DialogTitle>
          <DialogDescription>{text.desktopCloseBehaviorDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2" role="radiogroup" aria-label={text.desktopCloseBehavior}>
          {options.map((option) => {
            const selected = option.value === closeBehavior;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!available || loading || saving}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-md border border-border/80 bg-surface px-3 py-2 text-left transition-colors",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected && "border-primary bg-accent text-accent-foreground",
                  (!available || loading || saving) && "cursor-not-allowed opacity-60 hover:bg-surface"
                )}
                onClick={() => savePreference(option.value)}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-surface-raised">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>

        <p
          className={cn(
            "min-h-5 text-xs",
            error || !available ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {statusText}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function parseCloseBehavior(value: unknown): CloseBehavior {
  return value === "exit" || value === "minimize" || value === "ask" ? value : "ask";
}

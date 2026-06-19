import Link from "next/link";
import { cn } from "~/lib/utils";
import { languageLabels, localizedHref, type Locale } from "~/lib/i18n";

export function LanguageSwitcher({ locale, path }: { locale: Locale; path: string }) {
  return (
    <div className="inline-flex h-8 rounded-md border border-border/80 bg-surface-muted p-0.5 text-xs shadow-xs">
      {(["zh", "en"] as const).map((entry) => {
        const active = entry === locale;
        return (
          <Link
            key={entry}
            className={cn(
              "inline-flex items-center rounded-sm px-3 font-medium transition-colors",
              active
                ? "bg-surface-raised text-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            href={localizedHref(path, entry)}
          >
            {languageLabels[entry]}
          </Link>
        );
      })}
    </div>
  );
}

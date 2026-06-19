import { Inbox } from "lucide-react";
import { cn } from "~/lib/utils";
import { type Locale } from "~/lib/i18n";

export function EmptyState({
  locale: _locale,
  title,
  body,
  className
}: {
  locale: Locale;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-4 py-16 text-center",
        className
      )}
    >
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-border/80 bg-surface-muted shadow-xs">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

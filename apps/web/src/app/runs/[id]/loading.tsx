import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";

export default function RunDetailLoading() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-80 max-w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-24" />
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <Card className="overflow-hidden border-border bg-card py-0 shadow-sm">
          <div className="space-y-2 border-b border-border px-5 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <div className="space-y-5 px-5 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid gap-4 md:grid-cols-[150px_minmax(0,1fr)]">
                <Skeleton className="h-9 w-32" />
                <div className="space-y-2 border-l border-border pl-5">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="border-border bg-card py-0 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="space-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border bg-card py-0 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

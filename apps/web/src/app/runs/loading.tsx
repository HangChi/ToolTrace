import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";

export default function RunsLoading() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-64" />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border bg-card py-0 shadow-sm">
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-14" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-5 overflow-hidden border-border bg-card py-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-3 px-5 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[260px_150px_130px_1fr] items-center gap-4 py-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}

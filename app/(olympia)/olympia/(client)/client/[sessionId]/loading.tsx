import { Skeleton } from '@/components/ui/skeleton'

export default function OlympiaGameLoading() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <div className="flex-1 space-y-4">
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-56 w-full rounded-lg" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-4 w-72" />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border bg-slate-50 p-3">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="mb-2 h-6 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <Skeleton className="mb-3 h-5 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

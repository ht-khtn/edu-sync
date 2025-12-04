import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardHeader } from "@/components/ui/card"

export default function ClientLoading() {
  return (
    <div className="space-y-12">
      {/* Hero skeleton */}
      <div className="relative h-64 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900">
        <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6">
          <Skeleton className="h-10 w-96 mb-4 bg-slate-200 dark:bg-slate-700" />
          <Skeleton className="h-6 w-64 bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-8">
        {/* Section 1 */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2 bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-5 w-64 bg-slate-200 dark:bg-slate-700" />
            </div>
            <Skeleton className="h-10 w-32 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2 bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-full mb-2 bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Section 2 */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2 bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-5 w-64 bg-slate-200 dark:bg-slate-700" />
            </div>
            <Skeleton className="h-10 w-32 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2 bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-full mb-2 bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

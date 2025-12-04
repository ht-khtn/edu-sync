import { Card, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64 mb-2 bg-slate-200 dark:bg-slate-700" />
        <Skeleton className="h-5 w-96 bg-slate-200 dark:bg-slate-700" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2 bg-slate-200 dark:bg-slate-700" />
                  <Skeleton className="h-4 w-48 bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

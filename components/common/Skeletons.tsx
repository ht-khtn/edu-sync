/**
 * Reusable Skeleton Components for Loading States
 *
 * Prevent layout shift (CLS) by matching exact dimensions
 * of the component that will be loaded
 */

import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonProps {
  className?: string;
}

/**
 * Chart Skeleton - matches recharts ResponsiveContainer height
 */
export function ChartSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`w-full h-64 rounded-lg overflow-hidden ${className}`}>
      <Skeleton className="w-full h-full" />
    </div>
  );
}

/**
 * Card Skeleton - matches Card component dimensions
 */
export function CardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-lg border border-border p-6 space-y-4 ${className}`}>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/**
 * Table Row Skeleton - multiple rows for table loading
 */
export function TableRowSkeleton({ count = 5, className = '' }: SkeletonProps & { count?: number }) {
  return (
    <div className={`w-full space-y-2 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded" />
      ))}
    </div>
  );
}

/**
 * Table Header Skeleton - matches table header height
 */
export function TableHeaderSkeleton({ colCount = 4, className = '' }: SkeletonProps & { colCount?: number }) {
  return (
    <div className={`grid gap-2 ${className}`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
      {[...Array(colCount)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

/**
 * List Item Skeleton - for list/feed loading
 */
export function ListItemSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-lg border border-border p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Page Skeleton - full page loading state
 */
export function PageSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Content cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Table */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-1/4" />
        <TableRowSkeleton count={5} />
      </div>
    </div>
  );
}

/**
 * Stats Grid Skeleton - for dashboard stats
 */
export function StatsGridSkeleton({ count = 4, className = '' }: SkeletonProps & { count?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(count, 4)} ${className}`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Dialog Skeleton - for dialog/modal loading
 */
export function DialogSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm ${className}`}>
      <div className="rounded-lg border border-border bg-background p-6 shadow-lg w-full max-w-md space-y-4">
        <Skeleton className="h-6 w-2/3" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <Skeleton className="h-9 w-20 rounded" />
          <Skeleton className="h-9 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Timeline Skeleton - for timeline/feed layouts
 */
export function TimelineSkeleton({ count = 3, className = '' }: SkeletonProps & { count?: number }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="w-3 h-3 rounded-full flex-shrink-0 mt-1" />
          <div className="flex-1 space-y-2 pb-4 border-l-2 border-muted pl-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

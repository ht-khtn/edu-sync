/**
 * Example Chart Component with Dynamic Import Support
 *
 * This demonstrates how to structure chart components for lazy loading
 * Usage: Import with dynamic() to avoid loading recharts until needed
 */

'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ViolationsByTypeChartProps {
  data: Array<{
    name: string;
    violations: number;
    color?: string;
  }>;
  height?: number;
}

/**
 * Violation Statistics Bar Chart
 *
 * Shows violation count by category/type
 * Ready to be lazy-loaded with dynamic()
 */
export function ViolationsByTypeChart({
  data,
  height = 300
}: ViolationsByTypeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="violations" fill="#8884d8" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ViolationsTrendChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
  height?: number;
}

/**
 * Violations Trend Over Time
 *
 * Line chart showing violation trends
 * Ready to be lazy-loaded with dynamic()
 */
export function ViolationsTrendChart({
  data,
  height = 300
}: ViolationsTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" fill="#82ca9d" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Export all charts together for batch dynamic import
 *
 * Usage in page:
 * ```tsx
 * const Charts = dynamic(() => import('./ViolationCharts'), {
 *   loading: () => <ChartSkeleton />,
 *   ssr: true
 * });
 *
 * export default function Page() {
 *   return <Charts.ViolationsByTypeChart data={data} />;
 * }
 * ```
 */
export const Charts = {
  ViolationsByTypeChart,
  ViolationsTrendChart,
};

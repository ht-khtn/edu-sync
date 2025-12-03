import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Criteria } from '@/lib/violations'
import { cn } from '@/utils/cn'
import { EditCriteriaDialog } from './EditCriteriaDialog'
import { CriteriaRowActions } from './CriteriaRowActions'

type Props = {
  rows: Criteria[]
}

const typeColor: Record<string, string> = {
  normal: 'bg-muted text-foreground',
  serious: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200',
  critical: 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-200',
}

export function CriteriaTable({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border bg-background p-6 text-center text-muted-foreground">
        Chưa có tiêu chí nào phù hợp với bộ lọc.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên</TableHead>
            <TableHead>Mô tả</TableHead>
            <TableHead>Phạm vi</TableHead>
            <TableHead>Mức độ</TableHead>
            <TableHead>Điểm</TableHead>
            <TableHead>Nhóm</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <div>{row.name}</div>
                {row.subgroup && <div className="text-xs text-muted-foreground">{row.subgroup}</div>}
              </TableCell>
              <TableCell>
                <p className="text-sm text-muted-foreground line-clamp-2">{row.description || '—'}</p>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{row.category === 'class' ? 'Tập thể' : 'Học sinh'}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={cn('capitalize', typeColor[row.type || 'normal'] || 'bg-muted')}>
                  {row.type || 'normal'}
                </Badge>
              </TableCell>
              <TableCell>{Math.abs(row.points)}</TableCell>
              <TableCell>
                <div>{row.group || '—'}</div>
              </TableCell>
              <TableCell>
                {row.isActive ? (
                  <Badge variant="default">Đang dùng</Badge>
                ) : (
                  <Badge variant="secondary">Ngưng dùng</Badge>
                )}
              </TableCell>
              <TableCell className="space-x-1 text-right">
                <EditCriteriaDialog criteria={row} />
                <CriteriaRowActions criteria={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

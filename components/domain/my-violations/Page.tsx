"use client"

import { useUser } from '@/hooks/useUser'
import { useMyViolations } from '@/hooks/domain/useMyViolations'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { redirect } from 'next/navigation'

export default function MyViolationsPageContent() {
  const { user, isLoading: userLoading } = useUser()
  const { data: rows, isLoading: violationsLoading, isError, error } = useMyViolations(user?.id || null)

  if (userLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải thông tin người dùng...</p>
  }

  if (!user) {
    redirect('/login')
    return null
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vi phạm của tôi</h1>
        <p className="text-sm text-muted-foreground mt-1">Danh sách các ghi nhận vi phạm gắn với tài khoản của bạn.</p>
      </div>

      {isError && (
        <div className="border rounded p-3 bg-red-50 text-red-700 text-sm">
          Lỗi truy vấn: {error?.message || 'Unknown error'}
        </div>
      )}

      {violationsLoading && (
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
      )}

      {!violationsLoading && !isError && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Bạn chưa có ghi nhận vi phạm nào.</p>
      )}

      {!violationsLoading && rows.length > 0 && (
        <div className="border rounded-md bg-white p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>Tiêu chí</TableHead>
                <TableHead>Điểm</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  </TableCell>
                  <TableCell className="text-sm">{r.classes?.name || '—'}</TableCell>
                  <TableCell className="text-sm">{r.criteria?.name || '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{r.score}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-60 truncate" title={r.note || ''}>
                    {r.note || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}


"use client";

import { useUser } from "@/hooks/useUser";
import { useMyViolations } from "@/hooks/domain/useMyViolations";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { redirect } from "next/navigation";
import Loading from "@/components/common/LoadingComponent";

export default function MyViolationsPageContent() {
  const { user, isLoading: userLoading } = useUser();
  const {
    data: rows,
    isLoading: violationsLoading,
    isError,
    error,
  } = useMyViolations(user?.id || null);

  if (userLoading) {
    return <Loading message="Đang tải thông tin người dùng..." />;
  }

  if (!user) {
    redirect("/login");
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vi phạm của tôi</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Danh sách các ghi nhận vi phạm gắn với tài khoản của bạn.
        </p>
      </div>

      {isError && (
        <div className="rounded border bg-red-50 p-3 text-sm text-red-700">
          Lỗi truy vấn: {error?.message || "Unknown error"}
        </div>
      )}

      {violationsLoading && <p className="text-muted-foreground text-sm">Đang tải dữ liệu...</p>}

      {!violationsLoading && !isError && rows.length === 0 && (
        <p className="text-muted-foreground text-sm">Bạn chưa có ghi nhận vi phạm nào.</p>
      )}

      {!violationsLoading && rows.length > 0 && (
        <div className="rounded-md border bg-white p-2">
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
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </TableCell>
                  <TableCell className="text-sm">{r.classes?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{r.criteria?.name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{r.score}</TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-60 truncate text-sm"
                    title={r.note || ""}
                  >
                    {r.note || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

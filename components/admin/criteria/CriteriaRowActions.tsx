"use client"
// import { cn } from '@/utils/cn' // Removed unused import
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { deleteCriteriaAction, toggleCriteriaStatusAction } from '@/app/(admin)/admin/actions'
import type { Criteria } from '@/lib/violations'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

function SubmitButton({ children, variant }: { children: React.ReactNode; variant?: 'default' | 'destructive' | 'secondary' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? 'Đang xử lý...' : children}
    </Button>
  )
}

type Props = {
  criteria: Criteria
}

export function CriteriaRowActions({ criteria }: Props) {
  const [dialog, setDialog] = useState<'disable' | 'enable' | 'delete' | null>(null)

  return (
    <div className="flex items-center gap-2">
      {criteria.isActive ? (
        <AlertDialog open={dialog === 'disable'} onOpenChange={(open) => setDialog(open ? 'disable' : null)}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              Ngưng dùng
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ngưng sử dụng tiêu chí?</AlertDialogTitle>
              <AlertDialogDescription>
                Tiêu chí này sẽ không thể được chọn khi ghi nhận vi phạm. Bạn có thể kích hoạt lại sau.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction asChild>
                <form action={toggleCriteriaStatusAction}>
                  <input type="hidden" name="id" value={criteria.id} />
                  <input type="hidden" name="status" value="disable" />
                  <SubmitButton variant="destructive">Xác nhận</SubmitButton>
                </form>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <form action={toggleCriteriaStatusAction}>
          <input type="hidden" name="id" value={criteria.id} />
          <input type="hidden" name="status" value="enable" />
          <SubmitButton variant="secondary">Kích hoạt lại</SubmitButton>
        </form>
      )}

      <AlertDialog open={dialog === 'delete'} onOpenChange={(open) => setDialog(open ? 'delete' : null)}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Xóa tiêu chí</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tiêu chí?</AlertDialogTitle>
            <AlertDialogDescription>
              Nếu tiêu chí đã từng được sử dụng trong vi phạm, hệ thống sẽ tự động chuyển sang trạng thái ngưng dùng thay vì xóa hẳn.
            </AlertDialogDescription>
          </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction asChild>
                <form action={deleteCriteriaAction}>
                  <input type="hidden" name="id" value={criteria.id} />
                  <SubmitButton variant="destructive">Xác nhận</SubmitButton>
                </form>
              </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

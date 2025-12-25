'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { uploadQuestionSetAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function UploadQuestionSetDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(uploadQuestionSetAction, initialState)

  const hasMessage = state.error || state.success

  const handleOpenChange = (value: boolean) => {
    if (hasMessage && state.success) {
      setOpen(false)
    } else {
      setOpen(value)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Tải bộ đề (.xlsx)</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tải bộ đề từ Excel</DialogTitle>
          <DialogDescription>
            File .xlsx không có hàng tiêu đề, thứ tự cột: CODE · LĨNH VỰC/VỊ TRÍ · CÂU HỎI · ĐÁP ÁN · GHI CHÚ · NGƯỜI GỬI · NGUỒN · LINK ẢNH/VIDEO · LINK ÂM THANH.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4" encType="multipart/form-data">
          <div className="space-y-2">
            <Label htmlFor="name">Tên bộ đề</Label>
            <Input id="name" name="name" placeholder="Ví dụ: Tuần 05 - Bảng A" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File .xlsx</Label>
            <Input id="file" name="file" type="file" accept=".xlsx" required />
            <p className="text-xs text-muted-foreground">
              Mỗi hàng tương ứng 1 câu hỏi, để trống ô nếu không có dữ liệu. Hệ thống sẽ bỏ qua dòng thiếu CODE, CÂU HỎI hoặc ĐÁP ÁN.
            </p>
          </div>
          {hasMessage ? (
            <p className={cn('text-sm', state.error ? 'text-destructive' : 'text-green-600')}>
              {state.error ?? state.success}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit">Tải lên</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

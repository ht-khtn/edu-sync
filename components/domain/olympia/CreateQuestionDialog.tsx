'use client'

import { useEffect, useState } from 'react'
import { useFormState } from 'react-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createQuestionAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'

const initialState: ActionState = { error: null, success: null }

export function CreateQuestionDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState(createQuestionAction, initialState)

  useEffect(() => {
    if (state.success) {
      setOpen(false)
    }
  }, [state.success])

  const hasMessage = state.error || state.success

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Tạo câu hỏi</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm câu hỏi mới</DialogTitle>
          <DialogDescription>Nhập thông tin cơ bản để bổ sung vào kho đề Olympia.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">Mã câu hỏi</Label>
              <Input id="code" name="code" placeholder="OLY-123" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Chuyên mục</Label>
              <Input id="category" name="category" placeholder="Khởi động" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="questionText">Nội dung câu hỏi</Label>
            <Textarea id="questionText" name="questionText" rows={4} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="answerText">Đáp án</Label>
            <Input id="answerText" name="answerText" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" rows={2} placeholder="Tùy chọn" />
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
            <Button type="submit">Lưu câu hỏi</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

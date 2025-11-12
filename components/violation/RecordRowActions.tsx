"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import getSupabase from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal } from 'lucide-react'

export default function RecordRowActions({ id, initialScore, initialNote }: { id: string, initialScore?: number, initialNote?: string }) {
  const router = useRouter()
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [score, setScore] = useState<number | ''>(typeof initialScore === 'number' ? initialScore : '')
  const [note, setNote] = useState<string>(initialNote ?? '')
  const [loading, setLoading] = useState(false)

  async function onSave() {
    setLoading(true)
    try {
      const supabase = await getSupabase()
      const payload: any = { note: note ?? null }
      if (score !== '') payload.score = Number(score)
      const { error } = await supabase.from('records').update(payload).eq('id', id)
      if (error) throw error
      toast.success('Đã cập nhật ghi nhận')
      setOpenEdit(false)
      router.refresh()
    } catch (e: any) {
      toast.error(`Lỗi cập nhật: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  async function onDelete() {
    setLoading(true)
    try {
      const supabase = await getSupabase()
      const { error } = await supabase
        .from('records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Đã xoá ghi nhận')
      setOpenDelete(false)
      router.refresh()
    } catch (e: any) {
      toast.error(`Lỗi xoá: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Hành động">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenEdit(true)}>Chỉnh sửa</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDelete(true)} className="text-red-600 focus:text-red-700">Xoá</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa ghi nhận</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Điểm</label>
              <Input type="number" value={score} onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Ghi chú</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenEdit(false)} disabled={loading}>Huỷ</Button>
              <Button onClick={onSave} disabled={loading}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá ghi nhận?</AlertDialogTitle>
            <AlertDialogDescription>Hành động này sẽ ẩn ghi nhận khỏi danh sách (xoá mềm). Bạn có chắc không?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">Xoá</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

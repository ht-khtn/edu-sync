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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { MoreHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { isNetworkError, getErrorMessage } from '@/lib/network-utils'

export default function RecordRowActions({ id, initialNote, initialStudentId, initialCriteriaId, classId }: { id: string, initialNote?: string, initialStudentId?: string, initialCriteriaId?: string, classId?: string }) {
  const router = useRouter()
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [note, setNote] = useState<string>(initialNote ?? '')
  const [studentId, setStudentId] = useState<string | ''>(initialStudentId ?? '')
  const [criteriaId, setCriteriaId] = useState<string | ''>(initialCriteriaId ?? '')
  type StudentOption = { id: string; name: string }
  type CriteriaOption = { id: string; name: string }

  const [students, setStudents] = useState<StudentOption[]>([])
  const [criteriaList, setCriteriaList] = useState<CriteriaOption[]>([])
  const [loading, setLoading] = useState(false)

  async function onSave() {
    setLoading(true)
    try {
        const supabase = await getSupabase()
        const payload: { note: string | null; student_id?: string; criteria_id?: string } = { note: note ?? null }
      if (studentId) payload.student_id = studentId
      if (criteriaId) payload.criteria_id = criteriaId

      // capture before state
      const { data: before } = await supabase.from('records').select('*').eq('id', id).maybeSingle()

      const { error } = await supabase.from('records').update(payload).eq('id', id)
      if (error) throw error

      // write audit log (best-effort)
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const actor_id = userRes?.user?.id
        await supabase.from('audit_logs').insert({
          table_name: 'records',
          record_id: id,
          action: 'update',
          actor_id: actor_id ?? null,
          diff: { before, after: payload },
          meta: { source: 'record-row-actions' },
        })
      } catch {}

      toast.success('Đã cập nhật ghi nhận')
      setOpenEdit(false)
      router.refresh()
    } catch (e) {
      if (isNetworkError(e)) {
        toast.error('Không có kết nối mạng. Vui lòng kiểm tra và thử lại.')
      } else {
        toast.error(getErrorMessage(e))
      }
    } finally {
      setLoading(false)
    }
  }

  async function onDelete() {
    setLoading(true)
    try {
      const supabase = await getSupabase()
      const { data: before } = await supabase.from('records').select('*').eq('id', id).maybeSingle()
      const { error } = await supabase
        .from('records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const actor_id = userRes?.user?.id
        await supabase.from('audit_logs').insert({
          table_name: 'records',
          record_id: id,
          action: 'delete',
          actor_id: actor_id ?? null,
          diff: { before },
        })
      } catch (err) {
        console.error('Failed to log audit:', err)
      }
      toast.success('Đã xoá ghi nhận')
      setOpenDelete(false)
      router.refresh()
    } catch (e) {
      if (isNetworkError(e)) {
        toast.error('Không có kết nối mạng. Vui lòng kiểm tra và thử lại.')
      } else {
        toast.error(getErrorMessage(e))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!openEdit) return
    // fetch students and criteria when opening edit dialog
    (async () => {
      try {
        const supabase = await getSupabase()
        const critQ = await supabase.from('criteria').select('id,name')
        const usersQ = classId
          ? await supabase.from('users').select('id,user_profiles(full_name),user_name').eq('class_id', classId)
          : await supabase.from('users').select('id,user_profiles(full_name),user_name')

        setCriteriaList((critQ.data || []).map((c) => ({ id: String(c.id), name: c.name as string })))
        setStudents(
          (usersQ.data || []).map((u) => ({
            id: String(u.id),
            name:
              (Array.isArray(u.user_profiles) && u.user_profiles[0]?.full_name) ||
              // @ts-expect-error user_profiles may also be a single object depending on Supabase
              u.user_profiles?.full_name ||
              u.user_name ||
              String(u.id),
          })),
        )
      } catch {}
    })()
  }, [openEdit, classId])

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
            <DialogDescription>Cập nhật thông tin vi phạm, học sinh hoặc ghi chú</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {/* Score is not editable */}

            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Lỗi vi phạm</Label>
              <Select value={criteriaId || undefined} onValueChange={(v) => setCriteriaId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Chọn tiêu chí --" />
                </SelectTrigger>
                <SelectContent>
                  {criteriaList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Học sinh</Label>
              <Select value={studentId || undefined} onValueChange={(v) => setStudentId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="-- (không) --" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Ghi chú</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenEdit(false)} disabled={loading}>Huỷ</Button>
              <Button onClick={onSave} disabled={loading}>Lưu</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá ghi nhận?</DialogTitle>
            <DialogDescription>Hành động này sẽ ẩn ghi nhận khỏi danh sách (xoá mềm). Bạn có chắc không?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenDelete(false)} disabled={loading}>Huỷ</Button>
              <Button onClick={onDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">Xoá</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

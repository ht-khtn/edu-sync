'use client'

import { useActionState, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createParticipantAction, type ActionState } from '@/app/(olympia)/olympia/actions'
import { cn } from '@/utils/cn'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { sortByGivenName } from '@/lib/utils'

const initialState: ActionState = { error: null, success: null }

type ClassRow = { id: string; name: string }
type UserRow = {
  id: string
  user_name: string | null
  email: string | null
  class_id: string | null
  user_profiles?: { full_name: string | null } | Array<{ full_name: string | null }> | null
}

export function CreateParticipantDialog({ classes, users }: { classes?: ClassRow[]; users?: UserRow[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(createParticipantAction, initialState)

  const hasMessage = state.error || state.success

  // Close dialog on success
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
        <Button size="sm">Thêm tài khoản</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm tài khoản Olympia</DialogTitle>
          <DialogDescription>Nhập thông tin để tạo tài khoản thí sinh hoặc admin mới.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <AccountsUserSelector classes={classes} users={users} />

          <div className="space-y-2">
            <Label htmlFor="role">Vai trò</Label>
            <select 
              id="role" 
              name="role" 
              className="w-full rounded-md border px-3 py-2 text-sm"
              defaultValue="contestant"
            >
              <option value="contestant">Thí sinh</option>
              <option value="AD">Admin</option>
              <option value="MOD">Mod</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contestantCode">Mã thí sinh (tùy chọn)</Label>
            <Input 
              id="contestantCode" 
              name="contestantCode" 
              placeholder="VD: THI001, A-001"
            />
            <p className="text-xs text-muted-foreground">
              Để trống nếu không phải thí sinh
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
            <Button type="submit">Tạo tài khoản</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AccountsUserSelector({ classes = [], users = [] }: { classes?: ClassRow[]; users?: UserRow[] }) {
  const ALL_CLASSES = '__ALL__'
  const [selectedClass, setSelectedClass] = useState<string>(classes?.[0]?.id ?? ALL_CLASSES)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [manual, setManual] = useState(false)
  const [manualId, setManualId] = useState('')

  function getDisplay(u: UserRow) {
    const profileName = Array.isArray(u.user_profiles) ? u.user_profiles?.[0]?.full_name : u.user_profiles?.full_name
    return profileName && profileName !== 'Chưa cập nhật' ? profileName : u.user_name ?? u.email ?? '—'
  }

  const filtered = users.filter((u) => {
    if (!selectedClass || selectedClass === ALL_CLASSES) return true
    return u.class_id === selectedClass
  })

  const sorted = sortByGivenName(filtered, getDisplay)

  return (
    <>
      <section>
        <Label className="mb-2">Chọn lớp</Label>
        {classes && classes.length > 0 ? (
          <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedUser('') }}>
            <SelectTrigger>
              <SelectValue placeholder="-- Chọn lớp --" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-white">
              <SelectItem value={ALL_CLASSES}>Tất cả lớp</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="px-3 py-2 border rounded-md bg-muted text-sm text-muted-foreground">Không có lớp</div>
        )}
      </section>

      <section>
        <Label className="mb-2">Chọn người dùng</Label>
        <div className="flex items-center gap-3 mb-3">
          <input id="manual-id" type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
          <label htmlFor="manual-id" className="text-sm">Nhập thủ công UUID</label>
        </div>

        <input type="hidden" name="userId" value={manual ? manualId : selectedUser} />

        {manual ? (
          <Input placeholder="User UUID" value={manualId} onChange={(e) => setManualId(e.target.value)} />
        ) : (
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="-- Chọn người dùng --" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-white">
              {sorted.map((u, idx) => (
                <SelectItem key={u.id} value={u.id}>{`${idx + 1}. ${getDisplay(u)}${u.email ? ` — ${u.email}` : ''}`}</SelectItem>
              ))}
              {sorted.length === 0 && <div className="p-3 text-sm text-muted-foreground">Không tìm thấy người dùng</div>}
            </SelectContent>
          </Select>
        )}
      </section>
    </>
  )
}

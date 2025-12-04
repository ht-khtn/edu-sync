"use client"

import { useState } from 'react'
import { removeRoleAction } from '@/app/(admin)/admin/actions'
import { Button } from '@/components/ui/button'
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
import { Trash2 } from 'lucide-react'

export function RemoveRoleButton({
  roleRecordId,
  userDisplay,
  roleId,
}: {
  roleRecordId: string
  userDisplay: string
  roleId: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleRemove = async () => {
    setPending(true)
    const formData = new FormData()
    formData.append('roleRecordId', roleRecordId)
    await removeRoleAction(formData)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa vai trò?</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc muốn thu hồi vai trò <strong>{roleId}</strong> từ tài khoản{' '}
            <strong>{userDisplay}</strong>?
            <br />
            Hành động này không thể hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} disabled={pending} className="bg-destructive hover:bg-destructive/90">
            {pending ? 'Đang xóa...' : 'Xóa vai trò'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

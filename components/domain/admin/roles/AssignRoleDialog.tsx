"use client"

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { assignRoleAction } from '@/app/(admin)/admin/actions'
import { useFormStatus } from 'react-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/utils/cn'

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled} className="w-full">
      {pending ? 'Đang cập nhật...' : 'Gán vai trò'}
    </Button>
  )
}

export function AssignRoleDialog({
  users,
  roles,
}: {
  users: Array<{ id: string; label: string; description?: string }>
  roles: Array<{ id: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const [userPickerOpen, setUserPickerOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId), [selectedUserId, users])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Gán vai trò</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gán vai trò / cập nhật quyền</DialogTitle>
        </DialogHeader>
        <form action={assignRoleAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-user">Tài khoản</Label>
            <input type="hidden" name="userId" value={selectedUserId} />
            <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={userPickerOpen}
                  className="w-full justify-between"
                >
                  <span className={cn('truncate text-left', selectedUser ? '' : 'text-muted-foreground')}>
                    {selectedUser ? selectedUser.label : '-- Chọn người dùng --'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Tìm theo lớp, tên, email..." />
                  <CommandEmpty>Không tìm thấy người dùng.</CommandEmpty>
                  <ScrollArea className="h-[300px]">
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.label} ${user.description ?? ''}`}
                          onSelect={() => {
                            setSelectedUserId(user.id)
                            setUserPickerOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              user.id === selectedUserId ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <div className="flex flex-col text-left">
                            <span className="font-medium leading-none">{user.label}</span>
                            {user.description && (
                              <span className="text-xs text-muted-foreground">{user.description}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </ScrollArea>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-id">Vai trò</Label>
            <select
              id="role-id"
              name="roleId"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                -- Chọn vai trò --
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.id} {role.name ? `- ${role.name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-target">Target (tuỳ chọn)</Label>
            <Input id="role-target" name="target" placeholder="VD: 12A1 hoặc ALL" />
          </div>
          <DialogFooter>
            <SubmitButton disabled={!selectedUserId} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

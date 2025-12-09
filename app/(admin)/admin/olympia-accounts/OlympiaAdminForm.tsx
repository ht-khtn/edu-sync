'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type User = {
  id: string
  user_name: string | null
  email: string | null
  user_profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

export default function OlympiaAdminForm() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch all users on mount
  useEffect(() => {
    (async () => {
      try {
        const { getSupabase } = await import('@/lib/supabase')
        const supabase = await getSupabase()
        const { data, error } = await supabase
          .from('users')
          .select('id, user_name, email, user_profiles(full_name)')
          .order('user_name')
          .limit(500)
        if (error) throw error
        setUsers(data || [])
        setFilteredUsers(data || [])
      } catch (e) {
        toast.error('Không tải được danh sách người dùng')
        console.error(e)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  // Filter users based on search text
  useEffect(() => {
    const text = searchText.toLowerCase()
    const filtered = users.filter((user) => {
      const fullName = resolveFullName(user).toLowerCase()
      const userName = (user.user_name || '').toLowerCase()
      const email = (user.email || '').toLowerCase()
      return fullName.includes(text) || userName.includes(text) || email.includes(text)
    })
    setFilteredUsers(filtered)
  }, [searchText, users])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) {
      toast.error('Vui lòng chọn một người dùng')
      return
    }

    setIsSubmitting(true)
    try {
      const { getSupabase } = await import('@/lib/supabase')
      const supabase = await getSupabase()
      const { error } = await supabase
        .schema('olympia')
        .from('participants')
        .upsert(
          {
            user_id: selectedUserId,
            role: 'AD',
          },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      toast.success('Đã cấp quyền admin Olympia cho người dùng')
      // Close dialog by triggering escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(escapeEvent)
    } catch (e) {
      toast.error('Cấp quyền thất bại')
      console.error(e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId)

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="user-search" className="text-sm font-medium">
          Tìm kiếm người dùng
        </Label>
        <Input
          id="user-search"
          placeholder="Tìm theo tên, tài khoản hoặc email..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="h-10"
          disabled={isLoading}
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Danh sách người dùng</Label>
        {isLoading ? (
          <div className="border rounded-lg h-40 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="border rounded-lg h-40 flex items-center justify-center text-muted-foreground text-sm">
            {searchText ? 'Không tìm thấy người dùng nào' : 'Không có người dùng'}
          </div>
        ) : (
          <ScrollArea className="border rounded-lg h-40">
            <div className="p-2 space-y-1">
              {filteredUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                >
                  <Checkbox
                    checked={selectedUserId === user.id}
                    onCheckedChange={() =>
                      setSelectedUserId(selectedUserId === user.id ? null : user.id)
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {resolveFullName(user)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {user.user_name} ({user.email})
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {selectedUser && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            Sẽ cấp quyền admin Olympia cho <strong>{resolveFullName(selectedUser)}</strong>
          </AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" disabled={isSubmitting}>
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={!selectedUserId || isSubmitting}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Cấp quyền
        </Button>
      </DialogFooter>
    </form>
  )
}

function resolveFullName(user: User): string {
  const profiles = user.user_profiles
  if (Array.isArray(profiles)) return profiles[0]?.full_name ?? user.user_name ?? '—'
  return profiles?.full_name ?? user.user_name ?? '—'
}

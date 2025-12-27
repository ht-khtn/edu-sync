'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { User, LogOut, Lock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface OlympiaClientNavProps {
    sticky?: boolean
}

export function OlympiaClientNav({ sticky = false }: OlympiaClientNavProps) {
    const router = useRouter()
    const sessionResult = useSession()
    const session = sessionResult?.data
    const [changePasswordOpen, setChangePasswordOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isChanging, setIsChanging] = useState(false)

    async function handleChangePassword() {
        if (!newPassword || !confirmPassword || !currentPassword) {
            toast.error('Vui lòng điền đầy đủ thông tin')
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error('Mật khẩu xác nhận không khớp')
            return
        }
        if (newPassword.length < 6) {
            toast.error('Mật khẩu phải có ít nhất 6 ký tự')
            return
        }

        setIsChanging(true)
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                toast.error(result.error || 'Không thể thay đổi mật khẩu')
                return
            }

            toast.success('Đã thay đổi mật khẩu thành công')
            setChangePasswordOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error) {
            console.error('[ChangePassword]', error)
            toast.error('Lỗi khi thay đổi mật khẩu')
        } finally {
            setIsChanging(false)
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
            router.refresh()
        } catch (error) {
            console.error('[Logout]', error)
            toast.error('Lỗi khi đăng xuất')
        }
    }

    const isLoggedIn = !!session?.user

    return (
        <>
            <header
                className={`border-b bg-white ${sticky ? 'sticky top-0 z-40' : ''}`}
            >
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
                    <Link href="/olympia/client" className="text-base font-semibold">
                        EduSync Olympia
                    </Link>
                    <nav className="flex items-center gap-6">
                        <div className="flex gap-3 text-sm text-muted-foreground">
                            <Link href="/olympia/client" className="hover:text-slate-900">
                                Trang chủ
                            </Link>
                            <Link href="/olympia/client/join" className="hover:text-slate-900">
                                Tham gia
                            </Link>
                            <Link href="/olympia/client/matches" className="hover:text-slate-900">
                                Lịch thi
                            </Link>
                        </div>

                        {isLoggedIn ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2">
                                        <User className="h-4 w-4" />
                                        <span className="hidden sm:inline text-sm">Tài khoản</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <div className="px-2 py-1.5">
                                        <p className="text-sm text-muted-foreground">Tài khoản người dùng</p>
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setChangePasswordOpen(true)} className="cursor-pointer gap-2">
                                        <Lock className="h-4 w-4" />
                                        Đổi mật khẩu
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-red-600">
                                        <LogOut className="h-4 w-4" />
                                        Đăng xuất
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button asChild size="sm" variant="default">
                                <Link href="/login">Đăng nhập</Link>
                            </Button>
                        )}
                    </nav>
                </div>
            </header>

            {/* Change Password Dialog */}
            <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Đổi mật khẩu</DialogTitle>
                        <DialogDescription>Nhập mật khẩu hiện tại và mật khẩu mới</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Mật khẩu hiện tại</label>
                            <Input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Nhập mật khẩu hiện tại"
                                disabled={isChanging}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Mật khẩu mới</label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nhập mật khẩu mới"
                                disabled={isChanging}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Xác nhận mật khẩu</label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Xác nhận mật khẩu mới"
                                disabled={isChanging}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setChangePasswordOpen(false)}
                                disabled={isChanging}
                            >
                                Hủy
                            </Button>
                            <Button
                                onClick={handleChangePassword}
                                disabled={isChanging || !currentPassword || !newPassword}
                            >
                                {isChanging ? 'Đang thay đổi...' : 'Thay đổi'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

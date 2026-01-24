'use client'

import { useEffect, ReactNode } from 'react'

type Props = {
    children: ReactNode
}

/**
 * Client component để lưu current pathname vào localStorage
 * khi user truy cập routes trong /olympia/admin.
 * Dùng để redirect lại trang đúng sau khi login.
 */
export function OlympiaAdminPathSaver({ children }: Props) {
    useEffect(() => {
        // Chỉ lưu nếu đang trên /olympia/admin path
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/olympia/admin')) {
            localStorage.setItem('olympia-admin-redirect-path', window.location.pathname)
        }
    }, [])

    return <>{children}</>
}

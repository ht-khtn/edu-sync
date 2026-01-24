'use client'

import { useEffect, ReactNode, useRef } from 'react'

type Props = {
    children: ReactNode
}

/**
 * Client component để lưu current page path trước khi redirect tới login.
 * Khi user chưa authenticate, layout sẽ redirect tới /login?redirect=/olympia/admin
 * Nhưng component này sẽ:
 * 1. Lưu pathname hiện tại vào localStorage
 * 2. Thay thế redirect parameter bằng path thực tế người dùng đang truy cập
 */
export function AdminAuthRedirectHandler({ children }: Props) {
    const savedPathRef = useRef<string | null>(null)

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Lưu pathname hiện tại vào localStorage
            const currentPath = window.location.pathname
            localStorage.setItem('olympia-admin-redirect-path', currentPath)
            savedPathRef.current = currentPath

            // Kiểm tra xem có redirect parameter và nó trỏ tới /olympia/admin generic
            // Nếu có, hãy update nó để trỏ tới trang hiện tại
            const params = new URLSearchParams(window.location.search)
            const redirectParam = params.get('redirect')

            // Nếu redirect trỏ tới /olympia/admin (generic) và user đang ở trang khác,
            // hãy update localStorage để sử dụng trang hiện tại sau khi login
            if (redirectParam === '/olympia/admin' && currentPath !== '/olympia/admin') {
                // Sẽ được sử dụng bởi proxy.ts sau khi login
                localStorage.setItem('olympia-admin-redirect-path', currentPath)
            }
        }
    }, [])

    return <>{children}</>
}

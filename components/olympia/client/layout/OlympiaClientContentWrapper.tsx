'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { cn } from '@/utils/cn'

type Props = {
    children: ReactNode
}

export function OlympiaClientContentWrapper({ children }: Props) {
    const pathname = usePathname() ?? ''

    const shouldPad =
        pathname.startsWith('/olympia/client') &&
        !pathname.startsWith('/olympia/client/game') &&
        !pathname.startsWith('/olympia/client/watch') &&
        !pathname.startsWith('/olympia/client/guest')

    return (
        <div className={cn('min-h-screen', shouldPad && 'mx-auto w-full max-w-6xl px-4 py-6')}>{children}</div>
    )
}

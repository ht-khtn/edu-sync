'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client-side wrapper that listens for 'olympia:package-confirmed' event
 * and refetches/revalidates the page data without full reload.
 * 
 * This prevents losing the vdSeat selection while updating the confirmed state.
 */
export function VeDichPackageListener() {
    const router = useRouter()

    useEffect(() => {
        const handlePackageConfirmed = (event: Event) => {
            if (!(event instanceof CustomEvent)) return

            // Refetch/revalidate the current page to pick up the database changes
            // Using router.refresh() to refetch server-side data without navigation
            router.refresh()
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('olympia:package-confirmed', handlePackageConfirmed)
            return () => {
                window.removeEventListener('olympia:package-confirmed', handlePackageConfirmed)
            }
        }
    }, [router])

    return null
}

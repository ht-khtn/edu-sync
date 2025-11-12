"use client"

import { useEffect, useRef } from 'react'
import getSupabase from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Lightweight realtime listener: listens for inserts on public.records and refreshes the page.
// Shows a toast while an insert is detected.
export default function RecordsRealtimeListener() {
	const router = useRouter()
	const subscribed = useRef(false)

	useEffect(() => {
		if (subscribed.current) return
		subscribed.current = true
		let active = true
		;(async () => {
			const supabase = await getSupabase()
			const channel = supabase.channel('records-changes')
				.on(
					'postgres_changes',
					{ event: 'INSERT', schema: 'public', table: 'records' },
					(payload) => {
						if (!active) return
						toast.info('Có ghi nhận mới được thêm. Đang cập nhật...', { duration: 2000 })
						// Refresh server components so RecentRecordsList updates
						router.refresh()
					}
				)
				.subscribe()

			return () => {
				active = false
				supabase.removeChannel(channel)
			}
		})()
	}, [router])

	return null
}

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
	const pendingCountRef = useRef(0)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
					() => {
						if (!active) return
						pendingCountRef.current += 1
						if (timerRef.current) return
						timerRef.current = setTimeout(() => {
							const n = pendingCountRef.current
							pendingCountRef.current = 0
							timerRef.current = null
							toast.info(n > 1 ? `Có ${n} ghi nhận mới. Đang cập nhật...` : 'Có ghi nhận mới được thêm. Đang cập nhật...', { duration: 1800 })
							// Debounced refresh
							router.refresh()
						}, 800)
					}
				)
				.subscribe()

			return () => {
				active = false
				try { supabase.removeChannel(channel) } catch {}
				if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
			}
		})()
	}, [router])

	return null
}
